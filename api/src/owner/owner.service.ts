import { Injectable, Inject, BadRequestException, NotFoundException } from '@nestjs/common';
import { DATABASE_POOL } from '../database/database.module';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class OwnerService {
    constructor(
        @Inject(DATABASE_POOL) private readonly pool: any,
        private readonly auditService: AuditService,
    ) { }

    async dashboard() {
        const [financeRes, countsRes] = await Promise.all([
            this.pool.query(
                `SELECT
                    COALESCE(SUM(total_amount), 0)::numeric AS gmv,
                    COALESCE(SUM(platform_fee_amount), 0)::numeric AS fees,
                    COALESCE(SUM(CASE WHEN status = 'REFUNDED' THEN total_amount ELSE 0 END), 0)::numeric AS refunded
                 FROM orders
                 WHERE status IN ('PAID', 'FULFILLED', 'REFUNDED')`,
            ),
            this.pool.query(
                `SELECT
                    (SELECT COUNT(*)::int FROM users) AS users_count,
                    (SELECT COUNT(*)::int FROM listings) AS listings_count,
                    (SELECT COUNT(*)::int FROM orders) AS orders_count,
                    (SELECT COUNT(*)::int FROM auctions) AS auctions_count,
                    (SELECT COUNT(*)::int FROM ad_campaigns) AS ad_campaigns_count`,
            ),
        ]);

        return {
            financial: financeRes.rows[0],
            totals: countsRes.rows[0],
        };
    }

    async listUsers(page = 1, pageSize = 50, q?: string) {
        const safePage = Math.max(1, page);
        const safePageSize = Math.max(1, Math.min(pageSize, 200));
        const offset = (safePage - 1) * safePageSize;

        const params: any[] = [];
        let whereClause = '';

        if (q?.trim()) {
            params.push(`%${q.trim()}%`);
            whereClause = `WHERE (u.id::text ILIKE $1 OR COALESCE(u.email, '') ILIKE $1 OR COALESCE(u.name, '') ILIKE $1 OR COALESCE(u.phone, '') ILIKE $1)`;
        }

        const [countRes, dataRes] = await Promise.all([
            this.pool.query(`SELECT COUNT(*)::int AS count FROM users u ${whereClause}`, params),
            this.pool.query(
                `SELECT u.id, u.email, u.phone, u.name, u.role, u.created_at,
                        (
                          SELECT COUNT(*)::int FROM listings l WHERE l.owner_id = u.id
                        ) AS listings_count
                 FROM users u
                 ${whereClause}
                 ORDER BY u.created_at DESC
                 LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
                [...params, safePageSize, offset],
            ),
        ]);

        return {
            items: dataRes.rows,
            total: countRes.rows[0]?.count ?? 0,
            page: safePage,
            pageSize: safePageSize,
        };
    }

    async updateUserRole(targetUserId: string, role: string, reason: string, actorUserId: string) {
        if (!reason?.trim()) throw new BadRequestException('السبب مطلوب');

        const { rows } = await this.pool.query(
            `UPDATE users
             SET role = $2
             WHERE id = $1
             RETURNING id, email, role`,
            [targetUserId, role],
        );

        if (rows.length === 0) throw new NotFoundException('المستخدم غير موجود');

        await this.auditService.log({
            actorUserId,
            actorRole: 'SUPERADMIN',
            action: 'owner.user_role_update',
            entityType: 'user',
            entityId: targetUserId,
            meta: { role, reason: reason.trim() },
        });

        return rows[0];
    }

    async getSettings() {
        const { rows } = await this.pool.query('SELECT * FROM platform_settings WHERE id = 1');
        return rows[0] || null;
    }

    async updateSettings(input: {
        commission_bps?: number;
        minimum_fee?: number;
        settlement_delay_days?: number;
        auction_pick_next_highest?: boolean;
        enforce_domain_allowlist?: boolean;
        reason: string;
    }, actorUserId: string) {
        if (!input.reason?.trim()) throw new BadRequestException('السبب مطلوب');

        const updates: string[] = [];
        const values: any[] = [];

        const assign = (field: string, value: any) => {
            values.push(value);
            updates.push(`${field} = $${values.length}`);
        };

        if (input.commission_bps !== undefined) assign('commission_bps', input.commission_bps);
        if (input.minimum_fee !== undefined) assign('minimum_fee', input.minimum_fee);
        if (input.settlement_delay_days !== undefined) assign('settlement_delay_days', input.settlement_delay_days);
        if (input.auction_pick_next_highest !== undefined) assign('auction_pick_next_highest', input.auction_pick_next_highest);
        if (input.enforce_domain_allowlist !== undefined) assign('enforce_domain_allowlist', input.enforce_domain_allowlist);

        if (updates.length === 0) throw new BadRequestException('لا توجد تغييرات للتحديث');

        values.push(1);

        const { rows } = await this.pool.query(
            `UPDATE platform_settings
             SET ${updates.join(', ')}
             WHERE id = $${values.length}
             RETURNING *`,
            values,
        );

        await this.auditService.log({
            actorUserId,
            actorRole: 'SUPERADMIN',
            action: 'owner.settings_update',
            entityType: 'platform_settings',
            entityId: '1',
            meta: { ...input, reason: input.reason.trim() },
        });

        return rows[0];
    }

    async riskCenter() {
        const [generatedRisk, storedRisk] = await Promise.all([
            this.pool.query(
                `SELECT
                    'failed_payments_24h'::text AS type,
                    CASE WHEN COUNT(*) >= 20 THEN 'HIGH' WHEN COUNT(*) >= 10 THEN 'MEDIUM' ELSE 'LOW' END AS severity,
                    COUNT(*)::int AS count
                 FROM payments
                 WHERE status = 'FAILED'
                   AND updated_at >= NOW() - INTERVAL '24 hours'`,
            ),
            this.pool.query(
                `SELECT id, type, severity, entity_type, entity_id, details, created_at
                 FROM platform_risk_events
                 ORDER BY created_at DESC
                 LIMIT 100`,
            ),
        ]);

        return {
            computed: generatedRisk.rows[0],
            events: storedRisk.rows,
        };
    }

    async opsCenter() {
        const { rows } = await this.pool.query(
            `SELECT id, job_name, status, details, created_at
             FROM job_runs
             ORDER BY created_at DESC
             LIMIT 200`,
        );
        return { items: rows };
    }

    async exportEntity(entity: string) {
        const key = entity.toLowerCase();
        const map: Record<string, { sql: string; columns: string[] }> = {
            orders: {
                sql: 'SELECT id, user_id, status, total_amount, currency, created_at FROM orders ORDER BY created_at DESC LIMIT 10000',
                columns: ['id', 'user_id', 'status', 'total_amount', 'currency', 'created_at'],
            },
            users: {
                sql: 'SELECT id, email, phone, name, role, created_at FROM users ORDER BY created_at DESC LIMIT 10000',
                columns: ['id', 'email', 'phone', 'name', 'role', 'created_at'],
            },
            listings: {
                sql: 'SELECT id, owner_id, title, type, status, price, city, created_at FROM listings ORDER BY created_at DESC LIMIT 10000',
                columns: ['id', 'owner_id', 'title', 'type', 'status', 'price', 'city', 'created_at'],
            },
            ads: {
                sql: 'SELECT id, seller_id, listing_id, product_code, status, starts_at, ends_at, created_at FROM ad_campaigns ORDER BY created_at DESC LIMIT 10000',
                columns: ['id', 'seller_id', 'listing_id', 'product_code', 'status', 'starts_at', 'ends_at', 'created_at'],
            },
            auctions: {
                sql: 'SELECT id, listing_id, seller_id, status, starting_price, current_price, starts_at, ends_at, created_at FROM auctions ORDER BY created_at DESC LIMIT 10000',
                columns: ['id', 'listing_id', 'seller_id', 'status', 'starting_price', 'current_price', 'starts_at', 'ends_at', 'created_at'],
            },
            audit: {
                sql: 'SELECT id, actor_user_id, actor_role, action, entity_type, entity_id, created_at FROM audit_log ORDER BY created_at DESC LIMIT 10000',
                columns: ['id', 'actor_user_id', 'actor_role', 'action', 'entity_type', 'entity_id', 'created_at'],
            },
        };

        if (!map[key]) {
            throw new BadRequestException('نوع التصدير غير مدعوم');
        }

        const spec = map[key];
        const { rows } = await this.pool.query(spec.sql);

        const header = spec.columns.join(',');
        const lines = rows.map((row: any) => spec.columns.map((col) => this.escapeCsv(row[col])).join(','));
        const csv = [header, ...lines].join('\n');

        return {
            filename: `${key}-${new Date().toISOString().slice(0, 10)}.csv`,
            contentType: 'text/csv; charset=utf-8',
            csv,
            rows: rows.length,
        };
    }

    private escapeCsv(value: unknown) {
        if (value === null || value === undefined) return '';
        const str = String(value).replace(/"/g, '""');
        return /[",\n]/.test(str) ? `"${str}"` : str;
    }
}
