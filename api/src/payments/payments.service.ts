import { Injectable, Inject, Logger, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DATABASE_POOL } from '../database/database.module';
import { AuditService } from '../audit/audit.service';
import { SellerService } from '../seller/seller.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AdsService } from '../ads/ads.service';
import { PlansService } from '../plans/plans.service';

@Injectable()
export class PaymentsService {
    private readonly logger = new Logger(PaymentsService.name);
    private readonly tapUrl = 'https://api.tap.company/v2';
    private readonly secretKey: string;
    private readonly merchantId: string;

    constructor(
        private readonly config: ConfigService,
        @Inject(DATABASE_POOL) private readonly pool: any,
        private readonly auditService: AuditService,
        private readonly sellerService: SellerService,
        private readonly notificationsService: NotificationsService,
        private readonly adsService: AdsService,
        private readonly plansService: PlansService,
    ) {
        this.secretKey = this.config.get<string>('TAP_SECRET_KEY') || '';
        this.merchantId = this.config.get<string>('TAP_MERCHANT_ID') || '';

        if (!this.secretKey) {
            this.logger.warn('TAP_SECRET_KEY not set — payments disabled');
        }
    }

    async createPayment(orderId: string, userId: string) {
        if (!this.secretKey) {
            throw new BadRequestException('بوابة الدفع غير مُعدّة');
        }

        const { rows: orders } = await this.pool.query(
            'SELECT * FROM orders WHERE id = $1 AND user_id = $2',
            [orderId, userId],
        );
        if (orders.length === 0) throw new NotFoundException('الطلب غير موجود');

        const order = orders[0];
        if (order.status === 'PAID') throw new ConflictException('الطلب مدفوع مسبقاً');
        if (!['RESERVED', 'PENDING_PAYMENT', 'PENDING'].includes(order.status)) {
            throw new BadRequestException('لا يمكن دفع هذا الطلب');
        }

        const { rows: existingPayments } = await this.pool.query(
            `SELECT * FROM payments WHERE order_id = $1 AND status <> 'FAILED' LIMIT 1`,
            [orderId],
        );
        if (existingPayments.length > 0) {
            const existing = existingPayments[0];
            if (existing.status === 'PAID') {
                throw new ConflictException('الطلب مدفوع مسبقاً');
            }
            return {
                chargeId: existing.tap_charge_id,
                status: existing.status,
                amount: Number(existing.amount),
                currency: existing.currency,
                transactionUrl: null,
                orderId,
                idempotent: true,
            };
        }

        const { rows: users } = await this.pool.query('SELECT email, name FROM users WHERE id = $1', [userId]);
        const user = users[0] || {};

        const amount = Number(order.total_amount ?? order.total);

        const body = {
            amount,
            currency: order.currency || 'SAR',
            customer_initiated: true,
            threeDSecure: true,
            save_card: false,
            description: `Aljwharah Order ${orderId.substring(0, 8)}`,
            metadata: { order_id: orderId },
            reference: {
                transaction: `alj-${orderId.substring(0, 8)}-${Date.now()}`,
                order: orderId,
            },
            receipt: { email: true, sms: false },
            customer: {
                first_name: user.name || 'Customer',
                email: user.email,
            },
            merchant: { id: this.merchantId || undefined },
            source: { id: 'src_all' },
            redirect: {
                url: `https://aljwharah.ai/orders/${orderId}`,
            },
        };

        const res = await fetch(`${this.tapUrl}/charges`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${this.secretKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        });

        const data = await res.json();
        if (!res.ok) {
            this.logger.error(`Tap API error: ${JSON.stringify(data)}`);
            throw new BadRequestException(data.errors?.[0]?.description || 'فشل إنشاء عملية الدفع');
        }

        await this.pool.query(
            `INSERT INTO payments (order_id, tap_charge_id, status, amount, currency)
             VALUES ($1, $2, 'PENDING', $3, $4)
             ON CONFLICT (tap_charge_id) DO NOTHING`,
            [orderId, data.id, amount, order.currency || 'SAR'],
        );

        await this.pool.query(
            `UPDATE orders
             SET provider_charge_id = $1,
                 provider_reference = $2,
                 status = CASE WHEN status = 'RESERVED' THEN 'PENDING_PAYMENT' ELSE status END
             WHERE id = $3`,
            [data.id, data.reference?.transaction || '', orderId],
        );

        await this.pool.query(
            `INSERT INTO order_events (order_id, actor_user_id, actor_role, type, message, meta)
             VALUES ($1, $2, 'BUYER', 'payment.create', $3, $4)`,
            [orderId, userId, 'تم إنشاء رابط الدفع', JSON.stringify({ chargeId: data.id, amount })],
        );

        await this.auditService.log({
            actorUserId: userId,
            action: 'payment.create',
            entityType: 'order',
            entityId: orderId,
            meta: { chargeId: data.id, amount, currency: order.currency },
        });

        return {
            chargeId: data.id,
            status: data.status,
            amount: data.amount,
            currency: data.currency,
            transactionUrl: data.transaction?.url,
            orderId,
        };
    }

    async getCharge(chargeId: string) {
        const res = await fetch(`${this.tapUrl}/charges/${chargeId}`, {
            headers: { Authorization: `Bearer ${this.secretKey}` },
        });
        const data = await res.json();
        return {
            chargeId: data.id,
            status: data.status,
            amount: data.amount,
            currency: data.currency,
            receipt: data.receipt,
        };
    }

    async handleWebhook(payload: any) {
        this.logger.log(`Webhook received: ${payload.id} — ${payload.status}`);

        const adResult = await this.adsService.handleTapWebhook(payload);
        if (adResult) return { received: true, target: 'ads', ...adResult };

        const subscriptionResult = await this.plansService.handleTapWebhook(payload);
        if (subscriptionResult) return { received: true, target: 'subscriptions', ...subscriptionResult };

        const chargeId = payload.id;
        const status = payload.status;
        const orderId = payload.metadata?.order_id || payload.reference?.order;

        if (!orderId) {
            this.logger.warn('Webhook missing order_id in metadata');
            return { received: true, action: 'ignored — no order_id' };
        }

        const client = await this.pool.connect();
        let notifyCaptured: { userId: string; amount: number; currency: string } | null = null;
        let notifyFailedUserId: string | null = null;

        try {
            await client.query('BEGIN');

            const { rows: paymentRows } = await client.query(
                'SELECT * FROM payments WHERE tap_charge_id = $1 FOR UPDATE',
                [chargeId],
            );

            if (paymentRows.length > 0) {
                const payment = paymentRows[0];
                if (payment.status === 'PAID' || payment.status === 'FAILED') {
                    await client.query('COMMIT');
                    return { received: true, action: 'already processed', chargeId, orderId };
                }
            }

            const { rows } = await client.query(
                'SELECT * FROM orders WHERE id = $1 FOR UPDATE',
                [orderId],
            );
            if (rows.length === 0) {
                await client.query('COMMIT');
                return { received: true, action: 'order not found' };
            }

            const order = rows[0];

            if (order.status === 'PAID' || order.status === 'REFUNDED') {
                await client.query('COMMIT');
                return { received: true, action: 'already terminal', chargeId, orderId };
            }

            if (status === 'CAPTURED') {
                await client.query(
                    `UPDATE orders
                     SET status = 'PAID', paid_at = NOW(), provider_charge_id = $1
                     WHERE id = $2`,
                    [chargeId, orderId],
                );

                await client.query(
                    `UPDATE payments SET status = 'PAID' WHERE tap_charge_id = $1`,
                    [chargeId],
                );

                await client.query(
                    `INSERT INTO order_events (order_id, actor_user_id, actor_role, type, message, meta)
                     VALUES ($1, NULL, 'SYSTEM', 'payment.captured', $2, $3)`,
                    [orderId, 'تم تأكيد عملية الدفع بنجاح', JSON.stringify({ chargeId })],
                );

                const { rows: items } = await client.query(
                    'SELECT listing_id FROM order_items WHERE order_id = $1',
                    [orderId],
                );
                for (const item of items) {
                    await client.query(
                        `UPDATE listings
                         SET is_sold = true, reserved_until = NULL, reserved_by_order_id = NULL
                         WHERE id = $1 AND (is_sold = false OR is_sold IS NULL)`,
                        [item.listing_id],
                    );
                }

                await this.sellerService.creditOrderToPending(orderId, client);

                await this.auditService.log({
                    action: 'payment.captured',
                    entityType: 'order',
                    entityId: orderId,
                    meta: { chargeId, listingsCount: items.length },
                });

                notifyCaptured = {
                    userId: order.user_id,
                    amount: Number(order.total_amount ?? order.total),
                    currency: order.currency || 'SAR',
                };
            } else if (['FAILED', 'CANCELLED', 'DECLINED', 'TIMEDOUT', 'ABANDONED'].includes(status)) {
                await client.query(
                    `UPDATE orders
                     SET status = 'CANCELLED', provider_charge_id = $1
                     WHERE id = $2 AND status <> 'PAID'`,
                    [chargeId, orderId],
                );

                await client.query(
                    `UPDATE payments
                     SET status = 'FAILED'
                     WHERE tap_charge_id = $1 AND status <> 'PAID'`,
                    [chargeId],
                );

                await client.query(
                    `INSERT INTO order_events (order_id, actor_user_id, actor_role, type, message, meta)
                     VALUES ($1, NULL, 'SYSTEM', 'payment.failed', $2, $3)`,
                    [orderId, 'فشلت عملية الدفع', JSON.stringify({ chargeId, tapStatus: status })],
                );

                const { rows: items } = await client.query(
                    'SELECT listing_id FROM order_items WHERE order_id = $1',
                    [orderId],
                );
                for (const item of items) {
                    await client.query(
                        `UPDATE listings
                         SET reserved_until = NULL, reserved_by_order_id = NULL
                         WHERE id = $1 AND reserved_by_order_id = $2`,
                        [item.listing_id, orderId],
                    );
                }

                await this.auditService.log({
                    action: 'payment.failed',
                    entityType: 'order',
                    entityId: orderId,
                    meta: { chargeId, tapStatus: status },
                });

                notifyFailedUserId = order.user_id;
            } else {
                this.logger.log(`Order ${orderId} — unhandled status: ${status}`);
            }

            await client.query('COMMIT');

            if (notifyCaptured) {
                await this.notificationsService.notifyPaymentCaptured(
                    notifyCaptured.userId,
                    orderId,
                    notifyCaptured.amount,
                    notifyCaptured.currency,
                );
            }
            if (notifyFailedUserId) {
                await this.notificationsService.notifyPaymentFailed(notifyFailedUserId, orderId);
            }

            return { received: true, chargeId, orderId, action: status };
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    }
}
