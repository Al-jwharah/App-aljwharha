import { Injectable, Inject, Logger } from '@nestjs/common';
import { DATABASE_POOL } from '../database/database.module';

@Injectable()
export class JobsService {
    private readonly logger = new Logger(JobsService.name);

    constructor(@Inject(DATABASE_POOL) private readonly pool: any) { }

    /**
     * Release expired reservations and mark orders EXPIRED.
     * Idempotent: safe to call multiple times.
     */
    async releaseExpiredReservations(now: Date = new Date()) {
        const client = await this.pool.connect();
        let released = 0;

        try {
            await client.query('BEGIN');

            // Find orders that are RESERVED with expired reservation
            const { rows: expiredOrders } = await client.query(
                `SELECT o.id AS order_id
                 FROM orders o
                 WHERE o.status IN ('RESERVED', 'PENDING')
                   AND o.created_at < $1 - INTERVAL '15 minutes'
                 FOR UPDATE SKIP LOCKED`,
                [now],
            );

            for (const order of expiredOrders) {
                // Check if any listing is still reserved by this order
                const { rows: reservedListings } = await client.query(
                    `SELECT id FROM listings
                     WHERE reserved_by_order_id = $1
                       AND (reserved_until IS NOT NULL AND reserved_until < $2)
                     FOR UPDATE SKIP LOCKED`,
                    [order.order_id, now],
                );

                // Release reservation on listings
                if (reservedListings.length > 0) {
                    await client.query(
                        `UPDATE listings
                         SET reserved_until = NULL, reserved_by_order_id = NULL
                         WHERE reserved_by_order_id = $1 AND reserved_until < $2`,
                        [order.order_id, now],
                    );
                }

                // Mark order as CANCELLED (expired)
                await client.query(
                    `UPDATE orders SET status = 'CANCELLED' WHERE id = $1 AND status IN ('RESERVED', 'PENDING')`,
                    [order.order_id],
                );

                // Update payment record if exists
                await client.query(
                    `UPDATE payments SET status = 'CANCELLED' WHERE order_id = $1 AND status = 'PENDING'`,
                    [order.order_id],
                );

                released++;
            }

            await client.query('COMMIT');

            if (released > 0) {
                this.logger.log(`Released ${released} expired reservation(s)`);
            }

            return { released, timestamp: now.toISOString() };
        } catch (err) {
            await client.query('ROLLBACK');
            this.logger.error(`releaseExpiredReservations failed: ${(err as Error).message}`);
            throw err;
        } finally {
            client.release();
        }
    }

    /**
     * Reconcile pending payments by checking Tap API.
     * Handles "webhook didn't arrive" cases.
     * Idempotent: reuses existing idempotency layer.
     */
    async reconcilePendingPayments(now: Date = new Date()) {
        const tapSecretKey = process.env.TAP_SECRET_KEY || '';
        if (!tapSecretKey) {
            this.logger.warn('TAP_SECRET_KEY not set — reconciliation skipped');
            return { reconciled: 0, reason: 'no tap key' };
        }

        // Find payments that are PENDING and older than 10 minutes
        const { rows: pendingPayments } = await this.pool.query(
            `SELECT p.id, p.order_id, p.tap_charge_id, p.status, p.created_at,
                    o.status AS order_status, o.id AS o_id
             FROM payments p
             JOIN orders o ON p.order_id = o.id
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
                // Fetch charge status from Tap
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
                    this.logger.log(`Reconciled charge ${payment.tap_charge_id} → PAID`);
                } else if (['FAILED', 'CANCELLED', 'DECLINED', 'TIMEDOUT', 'ABANDONED'].includes(tapStatus)) {
                    await this.applyPaymentFailure(payment.order_id, payment.tap_charge_id);
                    reconciled++;
                    this.logger.log(`Reconciled charge ${payment.tap_charge_id} → FAILED (${tapStatus})`);
                } else {
                    // Still INITIATED/AUTHORIZED — check if past reservation window
                    const createdAt = new Date(payment.created_at);
                    const ageMinutes = (now.getTime() - createdAt.getTime()) / 60000;
                    if (ageMinutes > 30) {
                        // Too old, mark as expired
                        await this.applyPaymentFailure(payment.order_id, payment.tap_charge_id);
                        reconciled++;
                        this.logger.log(`Reconciled charge ${payment.tap_charge_id} → EXPIRED (${ageMinutes.toFixed(0)}min old)`);
                    }
                }
            } catch (err) {
                this.logger.error(`Reconciliation error for charge ${payment.tap_charge_id}: ${(err as Error).message}`);
                errors++;
            }
        }

        this.logger.log(`Reconciliation complete: ${reconciled} reconciled, ${errors} errors, ${pendingPayments.length} checked`);
        return { reconciled, errors, checked: pendingPayments.length, timestamp: now.toISOString() };
    }

    /**
     * Apply CAPTURED transition (idempotent — checks current state before mutating)
     */
    private async applyPaymentSuccess(orderId: string, chargeId: string) {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');

            // Lock order
            const { rows } = await client.query(
                'SELECT status FROM orders WHERE id = $1 FOR UPDATE',
                [orderId],
            );
            if (rows.length === 0 || rows[0].status === 'PAID') {
                await client.query('COMMIT');
                return; // Already paid — idempotent
            }

            await client.query(
                `UPDATE orders SET status = 'PAID', paid_at = NOW(), provider_charge_id = $1 WHERE id = $2`,
                [chargeId, orderId],
            );

            await client.query(
                `UPDATE payments SET status = 'PAID' WHERE tap_charge_id = $1 AND status != 'PAID'`,
                [chargeId],
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

            await client.query('COMMIT');
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    }

    /**
     * Apply FAILED transition (idempotent — checks current state before mutating)
     */
    private async applyPaymentFailure(orderId: string, chargeId: string) {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');

            const { rows } = await client.query(
                'SELECT status FROM orders WHERE id = $1 FOR UPDATE',
                [orderId],
            );
            if (rows.length === 0 || rows[0].status === 'PAID' || rows[0].status === 'CANCELLED') {
                await client.query('COMMIT');
                return; // Already terminal — idempotent
            }

            await client.query(
                `UPDATE orders SET status = 'CANCELLED', provider_charge_id = $1 WHERE id = $2`,
                [chargeId, orderId],
            );

            await client.query(
                `UPDATE payments SET status = 'FAILED' WHERE tap_charge_id = $1 AND status NOT IN ('PAID', 'FAILED')`,
                [chargeId],
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
    }
}
