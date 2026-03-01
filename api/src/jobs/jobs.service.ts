import { Injectable, Inject, Logger } from '@nestjs/common';
import { DATABASE_POOL } from '../database/database.module';
import { AuditService } from '../audit/audit.service';
import { SellerService } from '../seller/seller.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AuctionsService } from '../auctions/auctions.service';
import { AdsService } from '../ads/ads.service';

@Injectable()
export class JobsService {
    private readonly logger = new Logger(JobsService.name);

    constructor(
        @Inject(DATABASE_POOL) private readonly pool: any,
        private readonly auditService: AuditService,
        private readonly sellerService: SellerService,
        private readonly notificationsService: NotificationsService,
        private readonly auctionsService: AuctionsService,
        private readonly adsService: AdsService,
    ) { }

    async releaseExpiredReservations(now: Date = new Date()) {
        const client = await this.pool.connect();
        let released = 0;
        const notifyUsers: Array<{ userId: string; orderId: string }> = [];

        try {
            await client.query('BEGIN');

            const { rows: expiredOrders } = await client.query(
                `SELECT o.id AS order_id, o.user_id
                 FROM orders o
                 WHERE o.status IN ('RESERVED', 'PENDING', 'PENDING_PAYMENT')
                   AND o.created_at < $1 - INTERVAL '15 minutes'
                 FOR UPDATE SKIP LOCKED`,
                [now],
            );

            for (const order of expiredOrders) {
                const { rows: reservedListings } = await client.query(
                    `SELECT id FROM listings
                     WHERE reserved_by_order_id = $1
                       AND (reserved_until IS NOT NULL AND reserved_until < $2)
                     FOR UPDATE SKIP LOCKED`,
                    [order.order_id, now],
                );

                if (reservedListings.length > 0) {
                    await client.query(
                        `UPDATE listings
                         SET reserved_until = NULL, reserved_by_order_id = NULL
                         WHERE reserved_by_order_id = $1 AND reserved_until < $2`,
                        [order.order_id, now],
                    );
                }

                await client.query(
                    `UPDATE orders
                     SET status = 'EXPIRED'
                     WHERE id = $1 AND status IN ('RESERVED', 'PENDING', 'PENDING_PAYMENT')`,
                    [order.order_id],
                );

                await client.query(
                    `UPDATE payments
                     SET status = 'FAILED'
                     WHERE order_id = $1 AND status = 'PENDING'`,
                    [order.order_id],
                );

                await client.query(
                    `INSERT INTO order_events (order_id, actor_user_id, actor_role, type, message, meta)
                     VALUES ($1, NULL, 'SYSTEM', 'reservation.expired', $2, $3)`,
                    [order.order_id, 'انتهت مهلة الحجز للطلب', JSON.stringify({ expiredAt: now.toISOString() })],
                );

                released++;
                notifyUsers.push({ userId: order.user_id, orderId: order.order_id });
            }

            await client.query('COMMIT');

            if (released > 0) {
                this.logger.log(`Released ${released} expired reservation(s)`);
                await this.auditService.log({
                    action: 'job.release_expired',
                    entityType: 'system',
                    entityId: 'release-expired',
                    meta: { released, timestamp: now.toISOString() },
                });
            }

            for (const item of notifyUsers) {
                await this.notificationsService.notifyReservationExpired(item.userId, item.orderId);
            }

            const result = { released, timestamp: now.toISOString() };
            await this.recordJobRun('release-expired', 'SUCCESS', result);
            return result;
        } catch (err) {
            await client.query('ROLLBACK');
            this.logger.error(`releaseExpiredReservations failed: ${(err as Error).message}`);
            await this.recordJobRun('release-expired', 'FAILED', { error: (err as Error).message });
            throw err;
        } finally {
            client.release();
        }
    }

    async reconcilePendingPayments(now: Date = new Date()) {
        const tapSecretKey = process.env.TAP_SECRET_KEY || '';
        if (!tapSecretKey) {
            this.logger.warn('TAP_SECRET_KEY not set — reconciliation skipped');
            const result = { reconciled: 0, reason: 'no tap key' };
            await this.recordJobRun('reconcile-payments', 'FAILED', result);
            return result;
        }

        const { rows: pendingPayments } = await this.pool.query(
            `SELECT p.id, p.order_id, p.tap_charge_id, p.status, p.created_at
             FROM payments p
             WHERE p.status = 'PENDING'
               AND p.tap_charge_id IS NOT NULL
               AND p.created_at < $1 - INTERVAL '10 minutes'
             ORDER BY p.created_at ASC
             LIMIT 50`,
            [now],
        );

        let reconciled = 0;
        let errors = 0;

        for (const payment of pendingPayments) {
            try {
                const res = await fetch(`https://api.tap.company/v2/charges/${payment.tap_charge_id}`, {
                    headers: { Authorization: `Bearer ${tapSecretKey}` },
                });

                if (!res.ok) {
                    this.logger.warn(`Tap API error for charge ${payment.tap_charge_id}: HTTP ${res.status}`);
                    errors++;
                    continue;
                }

                const data = await res.json();
                const tapStatus = data.status;

                if (tapStatus === 'CAPTURED') {
                    await this.applyPaymentSuccess(payment.order_id, payment.tap_charge_id);
                    reconciled++;
                } else if (['FAILED', 'CANCELLED', 'DECLINED', 'TIMEDOUT', 'ABANDONED'].includes(tapStatus)) {
                    await this.applyPaymentFailure(payment.order_id, payment.tap_charge_id);
                    reconciled++;
                } else {
                    const createdAt = new Date(payment.created_at);
                    const ageMinutes = (now.getTime() - createdAt.getTime()) / 60000;
                    if (ageMinutes > 30) {
                        await this.applyPaymentFailure(payment.order_id, payment.tap_charge_id);
                        reconciled++;
                    }
                }
            } catch (err) {
                this.logger.error(`Reconciliation error for charge ${payment.tap_charge_id}: ${(err as Error).message}`);
                errors++;
            }
        }

        await this.auditService.log({
            action: 'job.reconcile_payments',
            entityType: 'system',
            entityId: 'reconcile-payments',
            meta: { reconciled, errors, checked: pendingPayments.length },
        });

        const result = { reconciled, errors, checked: pendingPayments.length, timestamp: now.toISOString() };
        await this.recordJobRun('reconcile-payments', 'SUCCESS', result);
        return result;
    }

    async settleSellerBalances(settlementDays = Number(process.env.SETTLEMENT_DAYS || 7)) {
        const result = await this.sellerService.settlePendingBalances(settlementDays);
        await this.auditService.log({
            action: 'job.settle_balances',
            entityType: 'system',
            entityId: 'settle-balances',
            meta: { settlementDays, ...result },
        });
        await this.recordJobRun('settle-balances', 'SUCCESS', { settlementDays, ...result });
        return result;
    }

    async processNotifications(limit = 50) {
        const result = await this.notificationsService.processOutboxBatch(limit);
        await this.auditService.log({
            action: 'job.process_notifications',
            entityType: 'system',
            entityId: 'process-notifications',
            meta: result,
        });
        await this.recordJobRun('process-notifications', 'SUCCESS', result);
        return result;
    }

    async closeEndedAuctions(limit = 50) {
        const result = await this.auctionsService.closeEndedAuctions(limit);
        await this.auditService.log({
            action: 'job.close_auctions',
            entityType: 'system',
            entityId: 'close-auctions',
            meta: result,
        });
        await this.recordJobRun('close-auctions', 'SUCCESS', result);
        return result;
    }

    async expireAdCampaigns(limit = 200) {
        const result = await this.adsService.expireCampaigns(limit);
        await this.auditService.log({
            action: 'job.expire_ads',
            entityType: 'system',
            entityId: 'expire-ads',
            meta: result,
        });
        await this.recordJobRun('expire-ads', 'SUCCESS', result);
        return result;
    }

    private async applyPaymentSuccess(orderId: string, chargeId: string) {
        const client = await this.pool.connect();
        let userId: string | null = null;
        let totalAmount = 0;
        let currency = 'SAR';

        try {
            await client.query('BEGIN');

            const { rows } = await client.query(
                'SELECT status, user_id, total_amount, total, currency FROM orders WHERE id = $1 FOR UPDATE',
                [orderId],
            );
            if (rows.length === 0 || rows[0].status === 'PAID') {
                await client.query('COMMIT');
                return;
            }

            userId = rows[0].user_id;
            totalAmount = Number(rows[0].total_amount ?? rows[0].total ?? 0);
            currency = rows[0].currency || 'SAR';

            await client.query(
                `UPDATE orders SET status = 'PAID', paid_at = NOW(), provider_charge_id = $1 WHERE id = $2`,
                [chargeId, orderId],
            );

            await client.query(
                `UPDATE payments SET status = 'PAID' WHERE tap_charge_id = $1 AND status != 'PAID'`,
                [chargeId],
            );

            await client.query(
                `INSERT INTO order_events (order_id, actor_user_id, actor_role, type, message, meta)
                 VALUES ($1, NULL, 'SYSTEM', 'payment.captured', $2, $3)`,
                [orderId, 'تمت تسوية الدفع آليًا عبر وظيفة reconciliation', JSON.stringify({ chargeId })],
            );

            const { rows: items } = await client.query(
                'SELECT listing_id FROM order_items WHERE order_id = $1',
                [orderId],
            );
            for (const item of items) {
                await client.query(
                    `UPDATE listings SET is_sold = true, reserved_until = NULL, reserved_by_order_id = NULL
                     WHERE id = $1 AND (is_sold = false OR is_sold IS NULL)`,
                    [item.listing_id],
                );
            }

            await this.sellerService.creditOrderToPending(orderId, client);
            await client.query('COMMIT');
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }

        if (userId) {
            await this.notificationsService.notifyPaymentCaptured(userId, orderId, totalAmount, currency);
        }
    }

    private async applyPaymentFailure(orderId: string, chargeId: string) {
        const client = await this.pool.connect();
        let userId: string | null = null;

        try {
            await client.query('BEGIN');

            const { rows } = await client.query(
                'SELECT status, user_id FROM orders WHERE id = $1 FOR UPDATE',
                [orderId],
            );
            if (rows.length === 0 || rows[0].status === 'PAID' || rows[0].status === 'CANCELLED' || rows[0].status === 'EXPIRED') {
                await client.query('COMMIT');
                return;
            }

            userId = rows[0].user_id;

            await client.query(
                `UPDATE orders SET status = 'CANCELLED', provider_charge_id = $1 WHERE id = $2`,
                [chargeId, orderId],
            );

            await client.query(
                `UPDATE payments SET status = 'FAILED' WHERE tap_charge_id = $1 AND status NOT IN ('PAID', 'FAILED')`,
                [chargeId],
            );

            await client.query(
                `INSERT INTO order_events (order_id, actor_user_id, actor_role, type, message, meta)
                 VALUES ($1, NULL, 'SYSTEM', 'payment.failed', $2, $3)`,
                [orderId, 'فشلت تسوية الدفع وتم إلغاء الطلب', JSON.stringify({ chargeId })],
            );

            const { rows: items } = await client.query(
                'SELECT listing_id FROM order_items WHERE order_id = $1',
                [orderId],
            );
            for (const item of items) {
                await client.query(
                    `UPDATE listings SET reserved_until = NULL, reserved_by_order_id = NULL
                     WHERE id = $1 AND reserved_by_order_id = $2`,
                    [item.listing_id, orderId],
                );
            }

            await client.query('COMMIT');
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }

        if (userId) {
            await this.notificationsService.notifyPaymentFailed(userId, orderId);
        }
    }

    private async recordJobRun(jobName: string, status: 'SUCCESS' | 'FAILED', details: Record<string, unknown>) {
        try {
            await this.pool.query(
                `INSERT INTO job_runs (job_name, status, details)
                 VALUES ($1, $2, $3)`,
                [jobName, status, JSON.stringify(details || {})],
            );
        } catch (err) {
            this.logger.warn(`Failed to record job run ${jobName}: ${(err as Error).message}`);
        }
    }
}
