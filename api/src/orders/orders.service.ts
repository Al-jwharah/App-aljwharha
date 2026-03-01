import { Injectable, Inject, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { DATABASE_POOL } from '../database/database.module';
import { CartService } from '../cart/cart.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { canRetryPayment } from '../common/status.enum';
import { PlansService } from '../plans/plans.service';

@Injectable()
export class OrdersService {
    private readonly logger = new Logger(OrdersService.name);

    constructor(
        @Inject(DATABASE_POOL) private readonly pool: any,
        private readonly cartService: CartService,
        private readonly auditService: AuditService,
        private readonly notificationsService: NotificationsService,
        private readonly plansService: PlansService,
    ) { }

    async checkout(userId: string) {
        const cart = await this.cartService.getCart(userId);
        const availableItems = cart.items.filter((i: any) => i.available);

        if (availableItems.length === 0) {
            throw new BadRequestException('السلة فارغة أو لا توجد إعلانات متاحة');
        }

        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');

            for (const item of availableItems) {
                const { rows } = await client.query(
                    'SELECT id, status, is_sold, reserved_until FROM listings WHERE id = $1 FOR UPDATE',
                    [item.listingId],
                );
                if (rows.length === 0 || rows[0].status !== 'APPROVED' || rows[0].is_sold) {
                    throw new BadRequestException(`الإعلان "${item.title}" لم يعد متاحاً`);
                }
                if (rows[0].reserved_until && new Date(rows[0].reserved_until) > new Date()) {
                    throw new BadRequestException(`الإعلان "${item.title}" محجوز حالياً`);
                }
            }

            const subtotal = availableItems.reduce((s: number, i: any) => s + Number(i.price || 0), 0);

            const { rows: settingsRows } = await client.query(
                'SELECT commission_bps, minimum_fee FROM platform_settings WHERE id = 1',
            );
            const commissionBps = settingsRows.length > 0 ? Number(settingsRows[0].commission_bps) : 500;
            const effectiveCommissionBps = await this.plansService.getCommissionBpsForUser(userId, commissionBps);
            const minimumFee = settingsRows.length > 0 ? Number(settingsRows[0].minimum_fee) : 0;
            const platformFee = Math.max(minimumFee, Math.round(subtotal * effectiveCommissionBps / 10000 * 100) / 100);
            const total = Math.round((subtotal + platformFee) * 100) / 100;

            const year = new Date().getFullYear();
            const { rows: seqRows } = await client.query(
                `INSERT INTO invoice_sequences (year, last_no) VALUES ($1, 1)
                 ON CONFLICT (year) DO UPDATE SET last_no = invoice_sequences.last_no + 1
                 RETURNING last_no`,
                [year],
            );
            const invoiceNo = `INV-${year}-${String(seqRows[0].last_no).padStart(6, '0')}`;

            const reserveUntil = new Date(Date.now() + 15 * 60 * 1000);
            const { rows: orderRows } = await client.query(
                `INSERT INTO orders (
                    user_id,
                    status,
                    subtotal_amount,
                    platform_fee_amount,
                    total,
                    total_amount,
                    currency,
                    invoice_no
                 ) VALUES ($1, 'RESERVED', $2, $3, $4, $4, 'SAR', $5)
                 RETURNING *`,
                [userId, subtotal, platformFee, total, invoiceNo],
            );
            const order = orderRows[0];

            await client.query(
                `INSERT INTO order_events (order_id, actor_user_id, actor_role, type, message, meta)
                 VALUES ($1, $2, 'BUYER', 'order.created', $3, $4)`,
                [
                    order.id,
                    userId,
                    'تم إنشاء الطلب وحجز العناصر مؤقتًا',
                    JSON.stringify({ invoiceNo, reserveUntil: reserveUntil.toISOString() }),
                ],
            );

            for (const item of availableItems) {
                await client.query(
                    'INSERT INTO order_items (order_id, listing_id, price, currency) VALUES ($1, $2, $3, $4)',
                    [order.id, item.listingId, item.price, item.currency],
                );
                await client.query(
                    'UPDATE listings SET reserved_until = $1, reserved_by_order_id = $2 WHERE id = $3',
                    [reserveUntil, order.id, item.listingId],
                );
            }

            await client.query('DELETE FROM cart_items WHERE cart_id = $1', [cart.cartId]);
            await client.query('COMMIT');

            this.logger.log(`Order ${order.id} (${invoiceNo}) — subtotal=${subtotal} fee=${platformFee} total=${total}`);
            await this.auditService.log({
                actorUserId: userId,
                action: 'order.create',
                entityType: 'order',
                entityId: order.id,
                meta: { invoiceNo, subtotal, platformFee, total, itemsCount: availableItems.length },
            });
            await this.notificationsService.notifyOrderCreated(userId, order.id, total, order.currency || 'SAR', reserveUntil.toISOString());

            return {
                ...order,
                reserveExpiresAt: reserveUntil.toISOString(),
                ui_status: 'PENDING_PAYMENT',
                items: availableItems.map((i: any) => ({
                    listingId: i.listingId,
                    title: i.title,
                    price: i.price,
                    currency: i.currency,
                })),
            };
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    }

    async retryPayment(orderId: string, userId: string) {
        const { rows } = await this.pool.query(
            `SELECT o.*, (
                SELECT MAX(l.reserved_until)
                FROM listings l
                WHERE l.reserved_by_order_id = o.id
            ) AS reserved_until
             FROM orders o
             WHERE o.id = $1 AND o.user_id = $2`,
            [orderId, userId],
        );
        if (rows.length === 0) throw new NotFoundException('الطلب غير موجود');

        const order = rows[0];
        if (!canRetryPayment(order.status, order.reserved_until)) {
            if (order.status === 'PAID') throw new BadRequestException('الطلب مدفوع مسبقاً');
            throw new BadRequestException('انتهت صلاحية الحجز — قم بإنشاء طلب جديد');
        }

        const { rows: payments } = await this.pool.query(
            `SELECT * FROM payments WHERE order_id = $1 AND status <> 'FAILED' LIMIT 1`,
            [orderId],
        );

        if (payments.length > 0 && payments[0].status === 'PAID') {
            throw new BadRequestException('الطلب مدفوع مسبقاً');
        }

        if (payments.length > 0 && payments[0].tap_charge_id) {
            return {
                chargeId: payments[0].tap_charge_id,
                redirectUrl: null,
                idempotent: true,
                expiresAt: order.reserved_until,
                orderId,
            };
        }

        return { action: 'create_payment', orderId, expiresAt: order.reserved_until };
    }

    async findAll(userId: string) {
        const { rows } = await this.pool.query(
            `SELECT
                o.*,
                reservation.reserved_until,
                latest_payment.tap_charge_id,
                latest_payment.status AS payment_status,
                latest_payment.amount AS payment_amount,
                latest_payment.currency AS payment_currency,
                latest_payment.updated_at AS payment_updated_at,
                CASE
                    WHEN o.status::text = 'PAID' THEN 'PAID'
                    WHEN o.status::text = 'FULFILLED' THEN 'PAID'
                    WHEN o.status::text = 'CANCELLED' THEN 'FAILED'
                    WHEN o.status::text = 'REFUNDED' THEN 'CANCELLED'
                    WHEN o.status::text IN ('RESERVED', 'PENDING', 'PENDING_PAYMENT')
                        AND reservation.reserved_until IS NOT NULL
                        AND reservation.reserved_until < NOW() THEN 'EXPIRED'
                    WHEN o.status::text IN ('RESERVED', 'PENDING', 'PENDING_PAYMENT') THEN 'PENDING_PAYMENT'
                    ELSE o.status::text
                END AS ui_status,
                COALESCE(items.items, '[]'::json) AS items
            FROM orders o
            LEFT JOIN LATERAL (
                SELECT MAX(l.reserved_until) AS reserved_until
                FROM order_items oi
                JOIN listings l ON l.id = oi.listing_id
                WHERE oi.order_id = o.id
            ) AS reservation ON true
            LEFT JOIN LATERAL (
                SELECT p.tap_charge_id, p.status, p.amount, p.currency, p.updated_at
                FROM payments p
                WHERE p.order_id = o.id
                ORDER BY p.updated_at DESC NULLS LAST, p.created_at DESC
                LIMIT 1
            ) AS latest_payment ON true
            LEFT JOIN LATERAL (
                SELECT json_agg(json_build_object(
                    'listingId', oi.listing_id,
                    'price', oi.price,
                    'currency', oi.currency,
                    'title', l.title,
                    'type', l.type,
                    'reserved_until', l.reserved_until
                )) AS items
                FROM order_items oi
                LEFT JOIN listings l ON oi.listing_id = l.id
                WHERE oi.order_id = o.id
            ) AS items ON true
            WHERE o.user_id = $1
            ORDER BY o.created_at DESC`,
            [userId],
        );
        return { data: rows, total: rows.length };
    }

    async findOne(orderId: string, userId: string) {
        const { rows } = await this.pool.query(
            `SELECT
                o.*,
                reservation.reserved_until,
                latest_payment.tap_charge_id,
                latest_payment.status AS payment_status,
                latest_payment.amount AS payment_amount,
                latest_payment.currency AS payment_currency,
                latest_payment.updated_at AS payment_updated_at,
                CASE
                    WHEN o.status::text = 'PAID' THEN 'PAID'
                    WHEN o.status::text = 'FULFILLED' THEN 'PAID'
                    WHEN o.status::text = 'CANCELLED' THEN 'FAILED'
                    WHEN o.status::text = 'REFUNDED' THEN 'CANCELLED'
                    WHEN o.status::text IN ('RESERVED', 'PENDING', 'PENDING_PAYMENT')
                        AND reservation.reserved_until IS NOT NULL
                        AND reservation.reserved_until < NOW() THEN 'EXPIRED'
                    WHEN o.status::text IN ('RESERVED', 'PENDING', 'PENDING_PAYMENT') THEN 'PENDING_PAYMENT'
                    ELSE o.status::text
                END AS ui_status,
                COALESCE(items.items, '[]'::json) AS items
            FROM orders o
            LEFT JOIN LATERAL (
                SELECT MAX(l.reserved_until) AS reserved_until
                FROM order_items oi
                JOIN listings l ON l.id = oi.listing_id
                WHERE oi.order_id = o.id
            ) AS reservation ON true
            LEFT JOIN LATERAL (
                SELECT p.tap_charge_id, p.status, p.amount, p.currency, p.updated_at
                FROM payments p
                WHERE p.order_id = o.id
                ORDER BY p.updated_at DESC NULLS LAST, p.created_at DESC
                LIMIT 1
            ) AS latest_payment ON true
            LEFT JOIN LATERAL (
                SELECT json_agg(json_build_object(
                    'listingId', oi.listing_id,
                    'price', oi.price,
                    'currency', oi.currency,
                    'title', l.title,
                    'type', l.type,
                    'reserved_until', l.reserved_until
                )) AS items
                FROM order_items oi
                LEFT JOIN listings l ON oi.listing_id = l.id
                WHERE oi.order_id = o.id
            ) AS items ON true
            WHERE o.id = $1 AND o.user_id = $2`,
            [orderId, userId],
        );

        if (rows.length === 0) throw new NotFoundException('الطلب غير موجود');
        return rows[0];
    }

    async getOrderEvents(orderId: string, userId: string, role: string) {
        if (!['ADMIN', 'SUPERADMIN'].includes(role)) {
            const { rows: orderRows } = await this.pool.query(
                'SELECT id FROM orders WHERE id = $1 AND user_id = $2',
                [orderId, userId],
            );
            if (orderRows.length === 0) {
                throw new NotFoundException('الطلب غير موجود');
            }
        }

        const { rows } = await this.pool.query(
            `SELECT id, order_id, actor_user_id, actor_role, type, message, meta, created_at
             FROM order_events
             WHERE order_id = $1
             ORDER BY created_at ASC, id ASC`,
            [orderId],
        );

        return { items: rows, total: rows.length };
    }
}
