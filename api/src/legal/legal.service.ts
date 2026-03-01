import { Injectable, Inject, NotFoundException, BadRequestException } from '@nestjs/common';
import { DATABASE_POOL } from '../database/database.module';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class LegalService {
    constructor(
        @Inject(DATABASE_POOL) private readonly pool: any,
        private readonly auditService: AuditService,
    ) { }

    async createReport(userId: string, listingId: string, reason: string, details?: string) {
        const { rows: listingRows } = await this.pool.query('SELECT id FROM listings WHERE id = $1', [listingId]);
        if (listingRows.length === 0) throw new NotFoundException('الإعلان غير موجود');

        const { rows } = await this.pool.query(
            `INSERT INTO infringement_reports (listing_id, reporter_user_id, reason, details, status)
             VALUES ($1, $2, $3, $4, 'OPEN')
             RETURNING *`,
            [listingId, userId, reason.trim(), details?.trim() || null],
        );

        await this.auditService.log({
            actorUserId: userId,
            action: 'legal.report_create',
            entityType: 'infringement_report',
            entityId: rows[0].id,
            meta: { listingId },
        });

        return rows[0];
    }

    async listReports(filters: {
        status?: string;
        q?: string;
        page?: number;
        pageSize?: number;
    }) {
        const page = Math.max(1, filters.page || 1);
        const pageSize = Math.max(1, Math.min(filters.pageSize || 20, 100));
        const offset = (page - 1) * pageSize;

        const where: string[] = [];
        const params: any[] = [];

        if (filters.status?.trim()) {
            params.push(filters.status.trim().toUpperCase());
            where.push(`r.status = $${params.length}`);
        }

        if (filters.q?.trim()) {
            params.push(`%${filters.q.trim()}%`);
            const i = params.length;
            where.push(`(
                r.id::text ILIKE $${i}
                OR r.listing_id::text ILIKE $${i}
                OR COALESCE(r.reason, '') ILIKE $${i}
                OR COALESCE(r.details, '') ILIKE $${i}
            )`);
        }

        const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

        const [countRes, dataRes] = await Promise.all([
            this.pool.query(`SELECT COUNT(*)::int AS count FROM infringement_reports r ${whereClause}`, params),
            this.pool.query(
                `SELECT r.*, l.title AS listing_title, reporter.email AS reporter_email, reviewer.email AS reviewer_email
                 FROM infringement_reports r
                 LEFT JOIN listings l ON l.id = r.listing_id
                 LEFT JOIN users reporter ON reporter.id = r.reporter_user_id
                 LEFT JOIN users reviewer ON reviewer.id = r.reviewed_by
                 ${whereClause}
                 ORDER BY r.created_at DESC
                 LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
                [...params, pageSize, offset],
            ),
        ]);

        return {
            items: dataRes.rows,
            total: countRes.rows[0]?.count ?? 0,
            page,
            pageSize,
        };
    }

    async resolveReport(
        reportId: string,
        input: { status: string; reason: string; actionTaken?: string },
        actorUserId: string,
        actorRole: string,
    ) {
        const status = input.status.trim().toUpperCase();
        const allowed = new Set(['IN_REVIEW', 'RESOLVED', 'REJECTED']);
        if (!allowed.has(status)) throw new BadRequestException('الحالة غير صالحة');
        if (!input.reason?.trim()) throw new BadRequestException('السبب مطلوب');

        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');

            const { rows } = await client.query(
                'SELECT * FROM infringement_reports WHERE id = $1 FOR UPDATE',
                [reportId],
            );
            if (rows.length === 0) throw new NotFoundException('البلاغ غير موجود');
            const report = rows[0];

            const actionTaken = input.actionTaken?.trim() || null;

            if (actionTaken === 'hide_listing' && report.listing_id) {
                await client.query(
                    `UPDATE listings
                     SET status = 'REJECTED',
                         metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
                            'legal', jsonb_build_object(
                                'infringement_report_id', $2,
                                'action', 'hide_listing',
                                'reviewed_by', $3,
                                'reviewed_at', NOW(),
                                'reason', $4
                            )
                         )
                     WHERE id = $1`,
                    [report.listing_id, reportId, actorUserId, input.reason.trim()],
                );
            }

            const { rows: updatedRows } = await client.query(
                `UPDATE infringement_reports
                 SET status = $2,
                     resolution = $3,
                     action_taken = $4,
                     reviewed_by = $5,
                     reviewed_at = NOW()
                 WHERE id = $1
                 RETURNING *`,
                [reportId, status, input.reason.trim(), actionTaken, actorUserId],
            );

            await client.query('COMMIT');

            await this.auditService.log({
                actorUserId,
                actorRole,
                action: 'legal.report_resolve',
                entityType: 'infringement_report',
                entityId: reportId,
                meta: { status, actionTaken, reason: input.reason.trim() },
            });

            return updatedRows[0];
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    }
}
