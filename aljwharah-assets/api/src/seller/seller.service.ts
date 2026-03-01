import { Injectable, Inject, BadRequestException, NotFoundException, ForbiddenException, Logger } from '@nestjs/common';
import { DATABASE_POOL } from '../database/database.module';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';

type PayoutFilters = {
    status?: string;
    q?: string;
    page?: number;
    pageSize?: number;
};

@Injectable()
export class SellerService {
    private readonly logger = new Logger(SellerService.name);

    constructor(
        @Inject(DATABASE_POOL) private readonly pool: any,
        private readonly auditService: AuditService,
        private readonly notificationsService: NotificationsService,
    ) { }

    async getSellerBalance(sellerId: string) {
        const { rows } = await this.pool.query(
            `INSERT INTO seller_balances (seller_id)
             VALUES ($1)
             ON CONFLICT (seller_id) DO NOTHING
             RETURNING seller_id`,
            [sellerId],
        );
        void rows;

        const { rows: balanceRows } = await this.pool.query(
            'SELECT seller_id, available_amount, pending_amount, updated_at FROM seller_balances WHERE seller_id = $1',
            [sellerId],
        );

        return balanceRows[0] || {
            seller_id: sellerId,
            available_amount: 0,
            pending_amount: 0,
            updated_at: new Date().toISOString(),
        };
    }

    async getSellerLedger(sellerId: string, page = 1, pageSize = 20) {
        const safePage = Math.max(1, page);
        const safePageSize = Math.max(1, Math.min(pageSize, 100));
        const offset = (safePage - 1) * safePageSize;

        const [countResult, dataResult] = await Promise.all([
            this.pool.query('SELECT COUNT(*)::int AS count FROM seller_ledger WHERE seller_id = $1', [sellerId]),
            this.pool.query(
                `SELECT id, seller_id, order_id, type, amount, note, created_at
                 FROM seller_ledger
                 WHERE seller_id = $1
                 ORDER BY created_at DESC, id DESC
                 LIMIT $2 OFFSET $3`,
                [sellerId, safePageSize, offset],
            ),
        ]);

        return {
            items: dataResult.rows,
            total: countResult.rows[0]?.count ?? 0,
            page: safePage,
            pageSize: safePageSize,
        };
    }

    async createPayoutRequest(sellerId: string, amount: number) {
        const payoutAmount = Number(amount);
        if (!Number.isFinite(payoutAmount) || payoutAmount <= 0) {
            throw new BadRequestException('قيمة السحب غير صالحة');
        }

        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');

            await client.query(
                `INSERT INTO seller_balances (seller_id)
                 VALUES ($1)
                 ON CONFLICT (seller_id) DO NOTHING`,
                [sellerId],
            );

            const { rows: balanceRows } = await client.query(
                'SELECT available_amount, pending_amount FROM seller_balances WHERE seller_id = $1 FOR UPDATE',
                [sellerId],
            );

            if (balanceRows.length === 0) throw new NotFoundException('رصيد البائع غير موجود');
            const available = Number(balanceRows[0].available_amount || 0);
            if (available < payoutAmount) {
                throw new BadRequestException('الرصيد المتاح غير كافٍ');
            }

            const { rows: requestRows } = await client.query(
                `INSERT INTO payout_requests (seller_id, amount, status)
                 VALUES ($1, $2, 'PENDING')
                 RETURNING *`,
                [sellerId, payoutAmount],
            );
            const request = requestRows[0];

            await client.query(
                `UPDATE seller_balances
                 SET available_amount = available_amount - $2
                 WHERE seller_id = $1`,
                [sellerId, payoutAmount],
            );

            await client.query(
                `INSERT INTO seller_ledger (seller_id, order_id, type, amount, note, entry_key)
                 VALUES ($1, NULL, 'DEBIT', $2, $3, $4)
                 ON CONFLICT (entry_key) DO NOTHING`,
                [sellerId, payoutAmount, 'Payout request hold', `payout:${request.id}:hold`],
            );

            await client.query('COMMIT');

            await this.auditService.log({
                actorUserId: sellerId,
                action: 'payout.request',
                entityType: 'payout_request',
                entityId: request.id,
                meta: { amount: payoutAmount },
            });

            return request;
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    }

    async listPayoutRequests(filters: PayoutFilters) {
        const page = Math.max(1, filters.page || 1);
        const pageSize = Math.max(1, Math.min(filters.pageSize || 20, 100));
        const offset = (page - 1) * pageSize;

        const where: string[] = [];
        const params: any[] = [];

        if (filters.status?.trim()) {
            params.push(filters.status.trim().toUpperCase());
            where.push(`pr.status = $${params.length}`);
        }

        if (filters.q?.trim()) {
            params.push(`%${filters.q.trim()}%`);
            const i = params.length;
            where.push(`(
                pr.id::text ILIKE $${i}
                OR pr.seller_id::text ILIKE $${i}
                OR COALESCE(u.email, '') ILIKE $${i}
            )`);
        }

        const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

        const [countResult, dataResult] = await Promise.all([
            this.pool.query(`SELECT COUNT(*)::int AS count FROM payout_requests pr LEFT JOIN users u ON u.id = pr.seller_id ${whereClause}`, params),
            this.pool.query(
                `SELECT pr.*, u.email AS seller_email, u.name AS seller_name
                 FROM payout_requests pr
                 LEFT JOIN users u ON u.id = pr.seller_id
                 ${whereClause}
                 ORDER BY pr.created_at DESC
                 LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
                [...params, pageSize, offset],
            ),
        ]);

        return {
            items: dataResult.rows,
            total: countResult.rows[0]?.count ?? 0,
            page,
            pageSize,
        };
    }

    async approvePayoutRequest(id: string, adminUserId: string) {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');

            const { rows } = await client.query(
                'SELECT * FROM payout_requests WHERE id = $1 FOR UPDATE',
                [id],
            );
            if (rows.length === 0) throw new NotFoundException('طلب السحب غير موجود');
            const request = rows[0];

            if (request.status === 'APPROVED') {
                await client.query('COMMIT');
                return request;
            }

            if (request.status !== 'PENDING') {
                throw new BadRequestException('لا يمكن اعتماد هذا الطلب');
            }

            const { rows: updatedRows } = await client.query(
                `UPDATE payout_requests
                 SET status = 'APPROVED', reviewed_by = $2, reviewed_at = NOW(), reason = COALESCE(reason, 'Approved')
                 WHERE id = $1
                 RETURNING *`,
                [id, adminUserId],
            );

            await client.query('COMMIT');

            const updated = updatedRows[0];

            await this.auditService.log({
                actorUserId: adminUserId,
                actorRole: 'ADMIN',
                action: 'payout.approve',
                entityType: 'payout_request',
                entityId: id,
                meta: { amount: updated.amount, sellerId: updated.seller_id },
            });

            await this.notificationsService.notifyPayoutApproved(updated.seller_id, updated.id, Number(updated.amount));

            return updated;
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    }

    async rejectPayoutRequest(id: string, reason: string, adminUserId: string) {
        if (!reason || !reason.trim()) {
            throw new BadRequestException('سبب الرفض مطلوب');
        }

        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');

            const { rows } = await client.query(
                'SELECT * FROM payout_requests WHERE id = $1 FOR UPDATE',
                [id],
            );
            if (rows.length === 0) throw new NotFoundException('طلب السحب غير موجود');
            const request = rows[0];

            if (request.status === 'REJECTED') {
                await client.query('COMMIT');
                return request;
            }

            if (request.status !== 'PENDING') {
                throw new BadRequestException('لا يمكن رفض هذا الطلب');
            }

            await client.query(
                `INSERT INTO seller_balances (seller_id)
                 VALUES ($1)
                 ON CONFLICT (seller_id) DO NOTHING`,
                [request.seller_id],
            );

            await client.query(
                `UPDATE seller_balances
                 SET available_amount = available_amount + $2
                 WHERE seller_id = $1`,
                [request.seller_id, request.amount],
            );

            await client.query(
                `INSERT INTO seller_ledger (seller_id, order_id, type, amount, note, entry_key)
                 VALUES ($1, NULL, 'ADJUSTMENT', $2, $3, $4)
                 ON CONFLICT (entry_key) DO NOTHING`,
                [request.seller_id, request.amount, 'Payout request rejected and amount released', `payout:${id}:release`],
            );

            const { rows: updatedRows } = await client.query(
                `UPDATE payout_requests
                 SET status = 'REJECTED', reason = $2, reviewed_by = $3, reviewed_at = NOW()
                 WHERE id = $1
                 RETURNING *`,
                [id, reason.trim(), adminUserId],
            );

            await client.query('COMMIT');

            await this.auditService.log({
                actorUserId: adminUserId,
                actorRole: 'ADMIN',
                action: 'payout.reject',
                entityType: 'payout_request',
                entityId: id,
                meta: { reason: reason.trim(), sellerId: request.seller_id, amount: request.amount },
            });

            return updatedRows[0];
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    }

    async creditOrderToPending(orderId: string, externalClient?: any) {
        const ownClient = !externalClient;
        const client = externalClient || await this.pool.connect();

        try {
            if (ownClient) await client.query('BEGIN');

            const { rows: sellerRows } = await client.query(
                `SELECT l.owner_id AS seller_id, COALESCE(SUM(oi.price), 0)::numeric AS amount
                 FROM order_items oi
                 JOIN listings l ON l.id = oi.listing_id
                 WHERE oi.order_id = $1
                   AND l.owner_id IS NOT NULL
                 GROUP BY l.owner_id`,
                [orderId],
            );

            let credited = 0;
            for (const row of sellerRows) {
                const sellerId = row.seller_id;
                const amount = Number(row.amount || 0);
                if (!sellerId || amount <= 0) continue;

                await client.query(
                    `INSERT INTO seller_balances (seller_id)
                     VALUES ($1)
                     ON CONFLICT (seller_id) DO NOTHING`,
                    [sellerId],
                );

                const entryKey = `order:${orderId}:credit:${sellerId}`;
                const ledgerInsert = await client.query(
                    `INSERT INTO seller_ledger (seller_id, order_id, type, amount, note, entry_key)
                     VALUES ($1, $2, 'CREDIT', $3, $4, $5)
                     ON CONFLICT (entry_key) DO NOTHING
                     RETURNING id`,
                    [sellerId, orderId, amount, 'Order paid credit to pending balance', entryKey],
                );

                if (ledgerInsert.rows.length > 0) {
                    await client.query(
                        `UPDATE seller_balances
                         SET pending_amount = pending_amount + $2
                         WHERE seller_id = $1`,
                        [sellerId, amount],
                    );
                    credited += 1;
                }
            }

            if (ownClient) await client.query('COMMIT');
            return { credited, sellers: sellerRows.length };
        } catch (err) {
            if (ownClient) await client.query('ROLLBACK');
            throw err;
        } finally {
            if (ownClient) client.release();
        }
    }

    async reverseOrderCredit(orderId: string, externalClient?: any) {
        const ownClient = !externalClient;
        const client = externalClient || await this.pool.connect();

        try {
            if (ownClient) await client.query('BEGIN');

            const { rows: sellerRows } = await client.query(
                `SELECT l.owner_id AS seller_id, COALESCE(SUM(oi.price), 0)::numeric AS amount
                 FROM order_items oi
                 JOIN listings l ON l.id = oi.listing_id
                 WHERE oi.order_id = $1
                   AND l.owner_id IS NOT NULL
                 GROUP BY l.owner_id`,
                [orderId],
            );

            let reversed = 0;
            for (const row of sellerRows) {
                const sellerId = row.seller_id;
                const amount = Number(row.amount || 0);
                if (!sellerId || amount <= 0) continue;

                await client.query(
                    `INSERT INTO seller_balances (seller_id)
                     VALUES ($1)
                     ON CONFLICT (seller_id) DO NOTHING`,
                    [sellerId],
                );

                const entryKey = `order:${orderId}:refund:${sellerId}`;
                const ledgerInsert = await client.query(
                    `INSERT INTO seller_ledger (seller_id, order_id, type, amount, note, entry_key)
                     VALUES ($1, $2, 'DEBIT', $3, $4, $5)
                     ON CONFLICT (entry_key) DO NOTHING
                     RETURNING id`,
                    [sellerId, orderId, amount, 'Order refund reversal', entryKey],
                );

                if (ledgerInsert.rows.length === 0) continue;

                const { rows: balanceRows } = await client.query(
                    `SELECT available_amount, pending_amount
                     FROM seller_balances
                     WHERE seller_id = $1
                     FOR UPDATE`,
                    [sellerId],
                );

                const available = Number(balanceRows[0]?.available_amount || 0);
                const pending = Number(balanceRows[0]?.pending_amount || 0);

                const fromPending = Math.min(pending, amount);
                const remaining = amount - fromPending;
                const fromAvailable = Math.min(available, remaining);

                await client.query(
                    `UPDATE seller_balances
                     SET pending_amount = GREATEST(0, pending_amount - $2),
                         available_amount = GREATEST(0, available_amount - $3)
                     WHERE seller_id = $1`,
                    [sellerId, fromPending, fromAvailable],
                );

                reversed += 1;
            }

            if (ownClient) await client.query('COMMIT');
            return { reversed, sellers: sellerRows.length };
        } catch (err) {
            if (ownClient) await client.query('ROLLBACK');
            throw err;
        } finally {
            if (ownClient) client.release();
        }
    }

    async settlePendingBalances(settlementDays = 7) {
        const client = await this.pool.connect();

        try {
            await client.query('BEGIN');

            const { rows } = await client.query(
                `SELECT sl.id, sl.seller_id, sl.order_id, sl.amount
                 FROM seller_ledger sl
                 JOIN orders o ON o.id = sl.order_id
                 WHERE sl.type = 'CREDIT'
                   AND o.status = 'PAID'
                   AND COALESCE(o.paid_at, o.updated_at, o.created_at) <= NOW() - ($1::text || ' days')::interval
                   AND NOT EXISTS (
                      SELECT 1 FROM seller_ledger ss
                      WHERE ss.entry_key = ('settlement:' || sl.id::text)
                   )
                 ORDER BY sl.created_at ASC
                 LIMIT 200`,
                [Math.max(1, settlementDays)],
            );

            let settled = 0;

            for (const row of rows) {
                const entryKey = `settlement:${row.id}`;
                const { rows: insertRows } = await client.query(
                    `INSERT INTO seller_ledger (seller_id, order_id, type, amount, note, entry_key)
                     VALUES ($1, $2, 'ADJUSTMENT', $3, $4, $5)
                     ON CONFLICT (entry_key) DO NOTHING
                     RETURNING id`,
                    [row.seller_id, row.order_id, row.amount, 'Settlement pending to available', entryKey],
                );

                if (insertRows.length === 0) continue;

                await client.query(
                    `INSERT INTO seller_balances (seller_id)
                     VALUES ($1)
                     ON CONFLICT (seller_id) DO NOTHING`,
                    [row.seller_id],
                );

                const { rows: balanceRows } = await client.query(
                    'SELECT pending_amount FROM seller_balances WHERE seller_id = $1 FOR UPDATE',
                    [row.seller_id],
                );
                const pending = Number(balanceRows[0]?.pending_amount || 0);
                const amount = Number(row.amount || 0);
                const settledAmount = Math.min(pending, amount);

                await client.query(
                    `UPDATE seller_balances
                     SET pending_amount = GREATEST(0, pending_amount - $2),
                         available_amount = available_amount + $2
                     WHERE seller_id = $1`,
                    [row.seller_id, settledAmount],
                );

                settled += 1;
            }

            await client.query('COMMIT');
            return { settled, checked: rows.length };
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    }
    async fulfillOrder(orderId: string, sellerId: string, notes: string, proofUrl?: string) {
        if (!notes?.trim()) {
            throw new BadRequestException('ملاحظات التسليم مطلوبة');
        }

        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');

            const { rows: orderRows } = await client.query(
                'SELECT id, status FROM orders WHERE id = $1 FOR UPDATE',
                [orderId],
            );
            if (orderRows.length === 0) throw new NotFoundException('الطلب غير موجود');

            const order = orderRows[0];
            if (!['PAID', 'FULFILLED'].includes(order.status)) {
                throw new BadRequestException('لا يمكن تسليم طلب غير مدفوع');
            }

            const { rows: ownerRows } = await client.query(
                `SELECT COUNT(*)::int AS count
                 FROM order_items oi
                 JOIN listings l ON l.id = oi.listing_id
                 WHERE oi.order_id = $1
                   AND l.owner_id = $2`,
                [orderId, sellerId],
            );

            if ((ownerRows[0]?.count ?? 0) < 1) {
                throw new ForbiddenException('لا تملك عناصر هذا الطلب');
            }

            if (order.status !== 'FULFILLED') {
                await client.query(
                    `UPDATE orders
                     SET status = 'FULFILLED'
                     WHERE id = $1`,
                    [orderId],
                );
            }

            await client.query(
                `INSERT INTO order_events (order_id, actor_user_id, actor_role, type, message, meta)
                 VALUES ($1, $2, 'SELLER', 'order.fulfill', $3, $4)`,
                [
                    orderId,
                    sellerId,
                    'تم إكمال تجهيز الطلب من البائع',
                    JSON.stringify({ notes: notes.trim(), proofUrl: proofUrl || null }),
                ],
            );

            await client.query('COMMIT');

            await this.auditService.log({
                actorUserId: sellerId,
                actorRole: 'SELLER',
                action: 'order.fulfill',
                entityType: 'order',
                entityId: orderId,
                meta: { notes: notes.trim(), proofUrl: proofUrl || null },
            });

            return { action: 'fulfilled', orderId };
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    }

    async addOrderNote(orderId: string, sellerId: string, note: string, attachmentUrl?: string) {
        if (!note?.trim()) {
            throw new BadRequestException('النص مطلوب');
        }

        const { rows } = await this.pool.query(
            `SELECT COUNT(*)::int AS count
             FROM order_items oi
             JOIN listings l ON l.id = oi.listing_id
             WHERE oi.order_id = $1
               AND l.owner_id = $2`,
            [orderId, sellerId],
        );

        if ((rows[0]?.count ?? 0) < 1) {
            throw new ForbiddenException('لا تملك عناصر هذا الطلب');
        }

        await this.pool.query(
            `INSERT INTO order_events (order_id, actor_user_id, actor_role, type, message, meta)
             VALUES ($1, $2, 'SELLER', 'order.note_add', $3, $4)`,
            [
                orderId,
                sellerId,
                note.trim(),
                JSON.stringify({ attachmentUrl: attachmentUrl || null }),
            ],
        );

        await this.auditService.log({
            actorUserId: sellerId,
            actorRole: 'SELLER',
            action: 'order.note_add',
            entityType: 'order',
            entityId: orderId,
            meta: { note: note.trim(), attachmentUrl: attachmentUrl || null },
        });

        return { action: 'noted', orderId };
    }
}


