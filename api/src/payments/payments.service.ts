import { Injectable, Inject, Logger, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DATABASE_POOL } from '../database/database.module';

@Injectable()
export class PaymentsService {
    private readonly logger = new Logger(PaymentsService.name);
    private readonly tapUrl = 'https://api.tap.company/v2';
    private readonly secretKey: string;
    private readonly merchantId: string;

    constructor(
        private readonly config: ConfigService,
        @Inject(DATABASE_POOL) private readonly pool: any,
    ) {
        this.secretKey = this.config.get<string>('TAP_SECRET_KEY') || '';
        this.merchantId = this.config.get<string>('TAP_MERCHANT_ID') || '';

        if (!this.secretKey) {
            this.logger.warn('TAP_SECRET_KEY not set — payments disabled');
        }
    }

    /**
     * Create a payment charge linked to an order (idempotent)
     */
    async createPayment(orderId: string, userId: string) {
        if (!this.secretKey) {
            throw new BadRequestException('بوابة الدفع غير مُعدّة');
        }

        // Fetch order + verify ownership
        const { rows: orders } = await this.pool.query(
            'SELECT * FROM orders WHERE id = $1 AND user_id = $2',
            [orderId, userId],
        );
        if (orders.length === 0) throw new NotFoundException('الطلب غير موجود');

        const order = orders[0];
        if (order.status === 'PAID') throw new ConflictException('الطلب مدفوع مسبقاً');
        if (order.status !== 'RESERVED' && order.status !== 'PENDING') {
            throw new BadRequestException('لا يمكن دفع هذا الطلب');
        }

        // ── Idempotency: check for existing active payment ──
        const { rows: existingPayments } = await this.pool.query(
            `SELECT * FROM payments WHERE order_id = $1 AND status NOT IN ('FAILED', 'CANCELLED') LIMIT 1`,
            [orderId],
        );
        if (existingPayments.length > 0) {
            const existing = existingPayments[0];
            if (existing.status === 'PAID') {
                throw new ConflictException('الطلب مدفوع مسبقاً');
            }
            // Return the existing pending charge info
            this.logger.log(`Returning existing payment ${existing.tap_charge_id} for order ${orderId}`);
            return {
                chargeId: existing.tap_charge_id,
                status: existing.status,
                amount: Number(existing.amount),
                currency: existing.currency,
                transactionUrl: null, // Cannot retrieve URL for existing charge; client should redirect via order page
                orderId,
                idempotent: true,
            };
        }

        // Fetch user email
        const { rows: users } = await this.pool.query('SELECT email, name FROM users WHERE id = $1', [userId]);
        const user = users[0] || {};

        const body = {
            amount: Number(order.total),
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

        this.logger.log(`Creating charge for order ${orderId}: ${order.total} ${order.currency}`);

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

        // Store payment record for idempotency tracking
        await this.pool.query(
            `INSERT INTO payments (order_id, tap_charge_id, status, amount, currency)
             VALUES ($1, $2, 'PENDING', $3, $4)
             ON CONFLICT (tap_charge_id) DO NOTHING`,
            [orderId, data.id, Number(order.total), order.currency || 'SAR'],
        );

        // Store charge ID on order
        await this.pool.query(
            'UPDATE orders SET provider_charge_id = $1, provider_reference = $2 WHERE id = $3',
            [data.id, data.reference?.transaction || '', orderId],
        );

        this.logger.log(`Charge ${data.id} created for order ${orderId}`);

        return {
            chargeId: data.id,
            status: data.status,
            amount: data.amount,
            currency: data.currency,
            transactionUrl: data.transaction?.url,
            orderId,
        };
    }

    /**
     * Get charge status
     */
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

    /**
     * Handle Tap webhook — idempotent order status mapping
     */
    async handleWebhook(payload: any) {
        this.logger.log(`Webhook received: ${payload.id} — ${payload.status}`);

        const chargeId = payload.id;
        const status = payload.status;
        const orderId = payload.metadata?.order_id || payload.reference?.order;

        if (!orderId) {
            this.logger.warn('Webhook missing order_id in metadata');
            return { received: true, action: 'ignored — no order_id' };
        }

        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');

            // ── Idempotency: lock payment row ──
            const { rows: paymentRows } = await client.query(
                'SELECT * FROM payments WHERE tap_charge_id = $1 FOR UPDATE',
                [chargeId],
            );

            if (paymentRows.length > 0) {
                const payment = paymentRows[0];
                if (payment.status === 'PAID' || payment.status === 'FAILED') {
                    // Already processed — return idempotent 200
                    await client.query('COMMIT');
                    this.logger.log(`Webhook for charge ${chargeId} already processed (${payment.status}) — skipping`);
                    return { received: true, action: 'already processed', chargeId, orderId };
                }
            }

            // Lock order row
            const { rows } = await client.query(
                'SELECT * FROM orders WHERE id = $1 FOR UPDATE',
                [orderId],
            );
            if (rows.length === 0) {
                this.logger.warn(`Order ${orderId} not found for webhook`);
                await client.query('COMMIT');
                return { received: true, action: 'order not found' };
            }

            const order = rows[0];

            // Idempotency: if order already in terminal state, skip
            if (order.status === 'PAID' || order.status === 'CANCELLED' || order.status === 'REFUNDED') {
                await client.query('COMMIT');
                this.logger.log(`Order ${orderId} already in terminal state (${order.status}) — skipping`);
                return { received: true, action: 'already terminal', chargeId, orderId };
            }

            if (status === 'CAPTURED') {
                // Payment successful
                await client.query(
                    `UPDATE orders SET status = 'PAID', paid_at = NOW(), provider_charge_id = $1 WHERE id = $2`,
                    [chargeId, orderId],
                );

                // Update payment record
                await client.query(
                    `UPDATE payments SET status = 'PAID' WHERE tap_charge_id = $1`,
                    [chargeId],
                );

                // Mark listings as sold + clear reservation
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

                this.logger.log(`Order ${orderId} PAID — ${items.length} listings marked as sold`);
            } else if (status === 'FAILED' || status === 'CANCELLED' || status === 'DECLINED' || status === 'TIMEDOUT') {
                // Payment failed — release reservations
                await client.query(
                    `UPDATE orders SET status = 'CANCELLED', provider_charge_id = $1 WHERE id = $2`,
                    [chargeId, orderId],
                );

                await client.query(
                    `UPDATE payments SET status = 'FAILED' WHERE tap_charge_id = $1`,
                    [chargeId],
                );

                const { rows: items } = await client.query(
                    'SELECT listing_id FROM order_items WHERE order_id = $1',
                    [orderId],
                );
                for (const item of items) {
                    await client.query(
                        'UPDATE listings SET reserved_until = NULL, reserved_by_order_id = NULL WHERE id = $1 AND reserved_by_order_id = $2',
                        [item.listing_id, orderId],
                    );
                }

                this.logger.log(`Order ${orderId} CANCELLED — reservations released`);
            } else {
                this.logger.log(`Order ${orderId} — unhandled status: ${status}`);
            }

            await client.query('COMMIT');
            return { received: true, chargeId, orderId, action: status };
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    }
}
