import { Injectable, Inject, BadRequestException, NotFoundException } from '@nestjs/common';
import { DATABASE_POOL } from '../database/database.module';

export type AdminListingStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

type Pagination = {
    page?: number;
    pageSize?: number;
};

type ListingFilters = Pagination & {
    status?: string;
    q?: string;
    ownerId?: string;
};

type OrderFilters = Pagination & {
    status?: string;
    q?: string;
};

type AuditFilters = Pagination & {
    q?: string;
    action?: string;
    entityType?: string;
};

@Injectable()
export class AdminService {
    constructor(@Inject(DATABASE_POOL) private readonly pool: any) { }

    private normalizePage(value?: number, fallback = 1) {
        if (!value || Number.isNaN(value) || value < 1) return fallback;
        return Math.floor(value);
    }

    private normalizePageSize(value?: number, fallback = 20) {
        if (!value || Number.isNaN(value) || value < 1) return fallback;
        return Math.min(Math.floor(value), 100);
    }

    private toDbListingStatus(status?: string): string | undefined {
        if (!status) return undefined;
        const normalized = status.toUpperCase();
        if (normalized === 'PENDING') return 'DRAFT';
        if (normalized === 'APPROVED') return 'APPROVED';
        if (normalized === 'REJECTED') return 'REJECTED';
        return undefined;
    }

    private toUiListingStatus(status: string): AdminListingStatus {
        if (status === 'DRAFT') return 'PENDING';
        if (status === 'APPROVED') return 'APPROVED';
        return 'REJECTED';
    }

    async listListings(filters: ListingFilters) {
        const page = this.normalizePage(filters.page, 1);
        const pageSize = this.normalizePageSize(filters.pageSize, 20);
        const offset = (page - 1) * pageSize;

        const where: string[] = [];
        const params: any[] = [];

        if (filters.status) {
            const dbStatus = this.toDbListingStatus(filters.status);
            if (!dbStatus) {
                throw new BadRequestException('قيمة status غير صالحة');
            }
            params.push(dbStatus);
            where.push(`l.status = $${params.length}`);
        }

        if (filters.ownerId) {
            params.push(filters.ownerId.trim());
            where.push(`l.owner_id = $${params.length}`);
        }

        if (filters.q?.trim()) {
            const pattern = `%${filters.q.trim()}%`;
            params.push(pattern);
            const idx = params.length;
            where.push(`(
                l.id::text ILIKE $${idx}
                OR l.title ILIKE $${idx}
                OR COALESCE(l.description, '') ILIKE $${idx}
                OR COALESCE(u.email, '') ILIKE $${idx}
                OR COALESCE(u.name, '') ILIKE $${idx}
            )`);
        }

        const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

        const countSql = `
            SELECT COUNT(*)::int AS count
            FROM listings l
            LEFT JOIN users u ON u.id = l.owner_id
            ${whereClause}
        `;

        const dataSql = `
            SELECT
                l.id,
                l.owner_id,
                l.title,
                l.description,
                l.type,
                l.status,
                l.price,
                l.currency,
                l.city,
                l.created_at,
                l.updated_at,
                c.name_ar AS category_name_ar,
                c.name_en AS category_name_en,
                u.email AS owner_email,
                u.name AS owner_name,
                (l.metadata->'review'->>'reason') AS reject_reason
            FROM listings l
            LEFT JOIN categories c ON c.id = l.category_id
            LEFT JOIN users u ON u.id = l.owner_id
            ${whereClause}
            ORDER BY l.created_at DESC
            LIMIT $${params.length + 1} OFFSET $${params.length + 2}
        `;

        const [countResult, dataResult] = await Promise.all([
            this.pool.query(countSql, params),
            this.pool.query(dataSql, [...params, pageSize, offset]),
        ]);

        return {
            items: dataResult.rows.map((row: any) => ({
                ...row,
                status: this.toUiListingStatus(row.status),
            })),
            total: countResult.rows[0]?.count ?? 0,
            page,
            pageSize,
        };
    }

    async getPendingListings() {
        return this.listListings({ status: 'PENDING', page: 1, pageSize: 50 });
    }

    async approveListing(id: string, actorUserId?: string | null) {
        const { rows } = await this.pool.query(
            `UPDATE listings
             SET
                status = 'APPROVED',
                metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
                    'review', jsonb_build_object(
                        'decision', 'APPROVED',
                        'reason', NULL,
                        'reviewed_at', NOW(),
                        'reviewed_by', $2
                    )
                )
             WHERE id = $1
             RETURNING *`,
            [id, actorUserId || null],
        );
        if (rows.length === 0) throw new NotFoundException('الإعلان غير موجود');
        return rows[0];
    }

    async rejectListing(id: string, reason: string, actorUserId?: string | null) {
        const cleanReason = reason.trim();
        if (!cleanReason) {
            throw new BadRequestException('سبب الرفض مطلوب');
        }

        const { rows } = await this.pool.query(
            `UPDATE listings
             SET
                status = 'REJECTED',
                metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
                    'review', jsonb_build_object(
                        'decision', 'REJECTED',
                        'reason', $2,
                        'reviewed_at', NOW(),
                        'reviewed_by', $3
                    )
                )
             WHERE id = $1
             RETURNING *`,
            [id, cleanReason, actorUserId || null],
        );
        if (rows.length === 0) throw new NotFoundException('الإعلان غير موجود');
        return rows[0];
    }

    async listOrders(filters: OrderFilters) {
        const page = this.normalizePage(filters.page, 1);
        const pageSize = this.normalizePageSize(filters.pageSize, 20);
        const offset = (page - 1) * pageSize;

        const where: string[] = [];
        const params: any[] = [];

        if (filters.status?.trim()) {
            params.push(filters.status.trim().toUpperCase());
            where.push(`o.status::text = $${params.length}`);
        }

        if (filters.q?.trim()) {
            const pattern = `%${filters.q.trim()}%`;
            params.push(pattern);
            const i = params.length;
            where.push(`(
                o.id::text ILIKE $${i}
                OR o.user_id::text ILIKE $${i}
                OR EXISTS (
                    SELECT 1 FROM payments p
                    WHERE p.order_id = o.id
                      AND COALESCE(p.tap_charge_id, '') ILIKE $${i}
                )
            )`);
        }

        const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

        const countSql = `
            SELECT COUNT(*)::int AS count
            FROM orders o
            ${whereClause}
        `;

        const dataSql = `
            SELECT
                o.id,
                o.user_id,
                o.status,
                o.total,
                o.total_amount,
                o.currency,
                o.created_at,
                o.updated_at,
                u.email AS user_email,
                u.name AS user_name,
                latest_payment.tap_charge_id,
                latest_payment.status AS payment_status,
                latest_payment.amount AS payment_amount,
                latest_payment.currency AS payment_currency,
                latest_payment.updated_at AS payment_updated_at,
                reservation.reserved_until,
                CASE
                    WHEN o.status::text = 'PAID' THEN 'PAID'
                    WHEN o.status::text = 'CANCELLED' THEN 'FAILED'
                    WHEN o.status::text = 'REFUNDED' THEN 'CANCELLED'
                    WHEN o.status::text IN ('RESERVED', 'PENDING', 'PENDING_PAYMENT')
                        AND reservation.reserved_until IS NOT NULL
                        AND reservation.reserved_until < NOW() THEN 'EXPIRED'
                    WHEN o.status::text IN ('RESERVED', 'PENDING', 'PENDING_PAYMENT') THEN 'PENDING_PAYMENT'
                    ELSE o.status::text
                END AS ui_status
            FROM orders o
            LEFT JOIN users u ON u.id = o.user_id
            LEFT JOIN LATERAL (
                SELECT p.tap_charge_id, p.status, p.amount, p.currency, p.updated_at
                FROM payments p
                WHERE p.order_id = o.id
                ORDER BY p.updated_at DESC NULLS LAST, p.created_at DESC
                LIMIT 1
            ) AS latest_payment ON true
            LEFT JOIN LATERAL (
                SELECT MAX(l.reserved_until) AS reserved_until
                FROM order_items oi
                JOIN listings l ON l.id = oi.listing_id
                WHERE oi.order_id = o.id
            ) AS reservation ON true
            ${whereClause}
            ORDER BY o.created_at DESC
            LIMIT $${params.length + 1} OFFSET $${params.length + 2}
        `;

        const [countResult, dataResult] = await Promise.all([
            this.pool.query(countSql, params),
            this.pool.query(dataSql, [...params, pageSize, offset]),
        ]);

        return {
            items: dataResult.rows,
            total: countResult.rows[0]?.count ?? 0,
            page,
            pageSize,
        };
    }

    async getOrderById(orderId: string) {
        const { rows } = await this.pool.query(
            `SELECT
                o.id,
                o.user_id,
                o.status,
                o.total,
                o.total_amount,
                o.currency,
                o.provider_charge_id,
                o.provider_reference,
                o.paid_at,
                o.created_at,
                o.updated_at,
                u.email AS user_email,
                u.name AS user_name,
                latest_payment.tap_charge_id,
                latest_payment.status AS payment_status,
                latest_payment.amount AS payment_amount,
                latest_payment.currency AS payment_currency,
                latest_payment.updated_at AS payment_updated_at,
                reservation.reserved_until,
                CASE
                    WHEN o.status::text = 'PAID' THEN 'PAID'
                    WHEN o.status::text = 'CANCELLED' THEN 'FAILED'
                    WHEN o.status::text = 'REFUNDED' THEN 'CANCELLED'
                    WHEN o.status::text IN ('RESERVED', 'PENDING', 'PENDING_PAYMENT')
                        AND reservation.reserved_until IS NOT NULL
                        AND reservation.reserved_until < NOW() THEN 'EXPIRED'
                    WHEN o.status::text IN ('RESERVED', 'PENDING', 'PENDING_PAYMENT') THEN 'PENDING_PAYMENT'
                    ELSE o.status::text
                END AS ui_status
             FROM orders o
             LEFT JOIN users u ON u.id = o.user_id
             LEFT JOIN LATERAL (
                SELECT p.tap_charge_id, p.status, p.amount, p.currency, p.updated_at
                FROM payments p
                WHERE p.order_id = o.id
                ORDER BY p.updated_at DESC NULLS LAST, p.created_at DESC
                LIMIT 1
             ) AS latest_payment ON true
             LEFT JOIN LATERAL (
                SELECT MAX(l.reserved_until) AS reserved_until
                FROM order_items oi
                JOIN listings l ON l.id = oi.listing_id
                WHERE oi.order_id = o.id
             ) AS reservation ON true
             WHERE o.id = $1`,
            [orderId],
        );

        if (rows.length === 0) {
            throw new NotFoundException('الطلب غير موجود');
        }

        const order = rows[0];

        const [{ rows: items }, { rows: events }] = await Promise.all([
            this.pool.query(
                `SELECT
                    oi.id,
                    oi.order_id,
                    oi.listing_id,
                    oi.price,
                    oi.currency,
                    l.title,
                    l.type,
                    l.city,
                    l.reserved_until
                FROM order_items oi
                LEFT JOIN listings l ON l.id = oi.listing_id
                WHERE oi.order_id = $1
                ORDER BY oi.id ASC`,
                [orderId],
            ),
            this.pool.query(
                `SELECT id, type, message, actor_role, actor_user_id, created_at, meta
                 FROM order_events
                 WHERE order_id = $1
                 ORDER BY created_at ASC, id ASC`,
                [orderId],
            ),
        ]);

        return {
            ...order,
            items,
            events,
            payment: {
                tap_charge_id: order.tap_charge_id,
                status: order.payment_status,
                amount: order.payment_amount,
                currency: order.payment_currency,
                updated_at: order.payment_updated_at,
            },
        };
    }

    async listAudit(filters: AuditFilters) {
        const page = this.normalizePage(filters.page, 1);
        const pageSize = this.normalizePageSize(filters.pageSize, 20);
        const offset = (page - 1) * pageSize;

        const where: string[] = [];
        const params: any[] = [];

        if (filters.action?.trim()) {
            params.push(filters.action.trim());
            where.push(`action = $${params.length}`);
        }

        if (filters.entityType?.trim()) {
            params.push(filters.entityType.trim());
            where.push(`entity_type = $${params.length}`);
        }

        if (filters.q?.trim()) {
            params.push(`%${filters.q.trim()}%`);
            const i = params.length;
            where.push(`(
                action ILIKE $${i}
                OR entity_type ILIKE $${i}
                OR entity_id ILIKE $${i}
                OR COALESCE(actor_user_id::text, '') ILIKE $${i}
                OR COALESCE(meta::text, '') ILIKE $${i}
            )`);
        }

        const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

        const countSql = `SELECT COUNT(*)::int AS count FROM audit_log ${whereClause}`;
        const dataSql = `
            SELECT id, created_at, action, entity_type, entity_id, actor_user_id, actor_role, meta
            FROM audit_log
            ${whereClause}
            ORDER BY created_at DESC
            LIMIT $${params.length + 1} OFFSET $${params.length + 2}
        `;

        const [countResult, dataResult] = await Promise.all([
            this.pool.query(countSql, params),
            this.pool.query(dataSql, [...params, pageSize, offset]),
        ]);

        return {
            items: dataResult.rows.map((row: any) => ({
                ...row,
                meta: typeof row.meta === 'string' ? this.safeJsonParse(row.meta) : (row.meta ?? {}),
            })),
            total: countResult.rows[0]?.count ?? 0,
            page,
            pageSize,
        };
    }

    private safeJsonParse(value: string) {
        try {
            return JSON.parse(value);
        } catch {
            return { raw: value };
        }
    }
}
