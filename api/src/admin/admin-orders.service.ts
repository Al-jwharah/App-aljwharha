import { Injectable, Inject, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { DATABASE_POOL } from '../database/database.module';
import { AuditService } from '../audit/audit.service';
import { isTerminalOrderStatus } from '../common/status.enum';
import { SellerService } from '../seller/seller.service';

@Injectable()
export class AdminOrdersService {
    private readonly logger = new Logger(AdminOrdersService.name);

    constructor(
        @Inject(DATABASE_POOL) private readonly pool: any,
        private readonly auditService: AuditService,
        private readonly sellerService: SellerService,
    ) { }

    async getOrder(orderId: string) {
        const { rows } = await this.pool.query(
            `SELECT o.*, json_agg(json_build_object(
                'listingId', oi.listing_id, 'price', oi.price, 'currency', oi.currency,
                'title', l.title, 'type', l.type
            )) AS items
            FROM orders o
            LEFT JOIN order_items oi ON o.id = oi.order_id
            LEFT JOIN listings l ON oi.listing_id = l.id
            WHERE o.id = $1 GROUP BY o.id`,
            [orderId],
        );
        if (rows.length === 0) throw new NotFoundException('الطلب غير موجود');
        return rows[0];
    }

    async markPaid(orderId: string, reason: string, adminUserId: string) {
        if (!reason || !reason.trim()) {
            throw new BadRequestException('السبب مطلوب');
        }

        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');
            const { rows } = await client.query('SELECT * FROM orders WHERE id = $1 FOR UPDATE', [orderId]);
            if (rows.length === 0) throw new NotFoundException('الطلب غير موجود');
            if (rows[0].status === 'PAID') {
                await client.query('COMMIT');
                return { action: 'already_paid', orderId };
            }
            if (isTerminalOrderStatus(rows[0].status) && rows[0].status !== 'RESERVED' && rows[0].status !== 'PENDING_PAYMENT') {
                throw new BadRequestException('لا يمكن تأكيد الدفع لهذا الطلب');
            }

            await client.query(`UPDATE orders SET status = 'PAID', paid_at = NOW() WHERE id = $1`, [orderId]);
            await client.query(`UPDATE payments SET status = 'PAID' WHERE order_id = $1 AND status = 'PENDING'`, [orderId]);

            const { rows: items } = await client.query('SELECT listing_id FROM order_items WHERE order_id = $1', [orderId]);
            for (const item of items) {
                await client.query(
                    `UPDATE listings SET is_sold = true, reserved_until = NULL, reserved_by_order_id = NULL WHERE id = $1`,
                    [item.listing_id],
                );
            }

            await this.sellerService.creditOrderToPending(orderId, client);

            await client.query('COMMIT');
            await this.auditService.log({
                actorUserId: adminUserId,
                actorRole: 'ADMIN',
                action: 'order.mark_paid_manual',
                entityType: 'order',
                entityId: orderId,
                meta: { reason: reason.trim(), listingsCount: items.length },
            });
            return { action: 'marked_paid', orderId };
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    }

    async cancelOrder(orderId: string, reason: string, adminUserId: string) {
        if (!reason || !reason.trim()) {
            throw new BadRequestException('السبب مطلوب');
        }

        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');
            const { rows } = await client.query('SELECT * FROM orders WHERE id = $1 FOR UPDATE', [orderId]);
            if (rows.length === 0) throw new NotFoundException('الطلب غير موجود');
            if (rows[0].status === 'CANCELLED') {
                await client.query('COMMIT');
                return { action: 'already_cancelled', orderId };
            }
            if (rows[0].status === 'PAID') throw new BadRequestException('لا يمكن إلغاء طلب مدفوع — استخدم الاسترجاع');

            await client.query(`UPDATE orders SET status = 'CANCELLED' WHERE id = $1`, [orderId]);
            await client.query(`UPDATE payments SET status = 'FAILED' WHERE order_id = $1 AND status = 'PENDING'`, [orderId]);

            const { rows: items } = await client.query('SELECT listing_id FROM order_items WHERE order_id = $1', [orderId]);
            for (const item of items) {
                await client.query(
                    `UPDATE listings SET reserved_until = NULL, reserved_by_order_id = NULL WHERE id = $1 AND reserved_by_order_id = $2`,
                    [item.listing_id, orderId],
                );
            }

            await client.query('COMMIT');
            await this.auditService.log({
                actorUserId: adminUserId,
                actorRole: 'ADMIN',
                action: 'order.cancel_admin',
                entityType: 'order',
                entityId: orderId,
                meta: { reason: reason.trim() },
            });
            return { action: 'cancelled', orderId };
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    }

    async reconcileOrder(orderId: string, adminUserId: string) {
        const tapKey = process.env.TAP_SECRET_KEY || '';
        if (!tapKey) throw new BadRequestException('TAP_SECRET_KEY not configured');

        const { rows } = await this.pool.query(
            `SELECT o.*, p.tap_charge_id
             FROM orders o
             LEFT JOIN payments p ON o.id = p.order_id
             WHERE o.id = $1`,
            [orderId],
        );
        if (rows.length === 0) throw new NotFoundException('الطلب غير موجود');
        if (!rows[0].tap_charge_id) throw new BadRequestException('لا يوجد معرّف دفع لهذا الطلب');

        const chargeId = rows[0].tap_charge_id;
        const res = await fetch(`https://api.tap.company/v2/charges/${chargeId}`, {
            headers: { Authorization: `Bearer ${tapKey}` },
        });
        if (!res.ok) throw new BadRequestException('فشل الاتصال ببوابة الدفع');
        const data = await res.json();

        await this.auditService.log({
            actorUserId: adminUserId,
            actorRole: 'ADMIN',
            action: 'order.reconcile_admin',
            entityType: 'order',
            entityId: orderId,
            meta: { tapStatus: data.status, chargeId },
        });

        return { orderId, chargeId, tapStatus: data.status, orderStatus: rows[0].status };
    }

    async markRefunded(orderId: string, reason: string, amount: number | undefined, currency: string | undefined, adminUserId: string) {
        if (!reason || !reason.trim()) {
            throw new BadRequestException('السبب مطلوب');
        }

        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');
            const { rows } = await client.query('SELECT * FROM orders WHERE id = $1 FOR UPDATE', [orderId]);
            if (rows.length === 0) throw new NotFoundException('الطلب غير موجود');
            if (rows[0].status === 'REFUNDED') {
                await client.query('COMMIT');
                return { action: 'already_refunded', orderId };
            }

            await client.query(`UPDATE orders SET status = 'REFUNDED' WHERE id = $1`, [orderId]);
            await this.sellerService.reverseOrderCredit(orderId, client);
            await client.query('COMMIT');

            await this.auditService.log({
                actorUserId: adminUserId,
                actorRole: 'ADMIN',
                action: 'order.refund_manual',
                entityType: 'order',
                entityId: orderId,
                meta: { reason: reason.trim(), amount: amount || rows[0].total, currency: currency || rows[0].currency },
            });
            return { action: 'refunded', orderId };
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    }
    async addNote(orderId: string, note: string, adminUserId: string, adminRole: string) {
        if (!note || !note.trim()) {
            throw new BadRequestException('النص مطلوب');
        }

        const { rows: orderRows } = await this.pool.query('SELECT id FROM orders WHERE id = $1', [orderId]);
        if (orderRows.length === 0) throw new NotFoundException('الطلب غير موجود');

        await this.pool.query(
            `INSERT INTO order_events (order_id, actor_user_id, actor_role, type, message, meta)
             VALUES ($1, $2, $3, 'order.note_add', $4, $5)`,
            [
                orderId,
                adminUserId,
                adminRole || 'ADMIN',
                note.trim(),
                JSON.stringify({ source: 'admin' }),
            ],
        );

        await this.auditService.log({
            actorUserId: adminUserId,
            actorRole: adminRole || 'ADMIN',
            action: 'order.note_add',
            entityType: 'order',
            entityId: orderId,
            meta: { note: note.trim(), source: 'admin' },
        });

        return { action: 'noted', orderId };
    }
}

