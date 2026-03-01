import {
    Injectable,
    Inject,
    NotFoundException,
    ForbiddenException,
    BadRequestException,
} from '@nestjs/common';
import { DATABASE_POOL } from '../database/database.module';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class SupportService {
    constructor(
        @Inject(DATABASE_POOL) private readonly pool: any,
        private readonly auditService: AuditService,
    ) { }

    async createTicket(userId: string, input: {
        subject: string;
        category: string;
        priority?: string;
        message?: string;
    }) {
        const priority = (input.priority || 'MEDIUM').toUpperCase();
        const allowedPriority = new Set(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);
        if (!allowedPriority.has(priority)) {
            throw new BadRequestException('قيمة priority غير صالحة');
        }

        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');

            const { rows } = await client.query(
                `INSERT INTO support_tickets (
                    user_id,
                    subject,
                    category,
                    priority,
                    status,
                    last_reply_at
                 ) VALUES ($1, $2, $3, $4, 'OPEN', NOW())
                 RETURNING *`,
                [userId, input.subject.trim(), input.category.trim(), priority],
            );

            const ticket = rows[0];

            if (input.message?.trim()) {
                await client.query(
                    `INSERT INTO support_messages (ticket_id, sender_type, sender_user_id, message, attachments)
                     VALUES ($1, 'USER', $2, $3, '[]'::jsonb)`,
                    [ticket.id, userId, input.message.trim()],
                );
            }

            await client.query('COMMIT');
            return ticket;
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    }

    async listUserTickets(userId: string) {
        const { rows } = await this.pool.query(
            `SELECT t.*,
                    a.agent_user_id,
                    u.name AS agent_name,
                    u.email AS agent_email,
                    (
                      SELECT COUNT(*)::int
                      FROM support_messages m
                      WHERE m.ticket_id = t.id
                    ) AS messages_count
             FROM support_tickets t
             LEFT JOIN support_assignments a ON a.ticket_id = t.id
             LEFT JOIN users u ON u.id = a.agent_user_id
             WHERE t.user_id = $1
             ORDER BY t.updated_at DESC`,
            [userId],
        );
        return { items: rows, total: rows.length };
    }

    async getUserTicket(ticketId: string, userId: string) {
        const ticket = await this.getTicketById(ticketId);
        if (ticket.user_id !== userId) {
            throw new ForbiddenException('لا يمكنك الوصول لهذه التذكرة');
        }
        return this.loadTicketDetails(ticketId);
    }

    async addUserMessage(ticketId: string, userId: string, message: string, attachments?: unknown) {
        const ticket = await this.getTicketById(ticketId);
        if (ticket.user_id !== userId) {
            throw new ForbiddenException('لا يمكنك الرد على هذه التذكرة');
        }
        if (ticket.status === 'CLOSED') {
            throw new BadRequestException('التذكرة مغلقة');
        }

        await this.pool.query(
            `INSERT INTO support_messages (ticket_id, sender_type, sender_user_id, message, attachments)
             VALUES ($1, 'USER', $2, $3, $4::jsonb)`,
            [ticketId, userId, message.trim(), JSON.stringify(attachments || [])],
        );

        await this.pool.query(
            `UPDATE support_tickets
             SET status = CASE WHEN status = 'RESOLVED' THEN 'PENDING' ELSE status END,
                 last_reply_at = NOW()
             WHERE id = $1`,
            [ticketId],
        );

        return this.loadTicketDetails(ticketId);
    }

    async listAdminTickets(filters: {
        status?: string;
        q?: string;
        category?: string;
        priority?: string;
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
            where.push(`t.status = $${params.length}`);
        }

        if (filters.category?.trim()) {
            params.push(filters.category.trim());
            where.push(`t.category = $${params.length}`);
        }

        if (filters.priority?.trim()) {
            params.push(filters.priority.trim().toUpperCase());
            where.push(`t.priority = $${params.length}`);
        }

        if (filters.q?.trim()) {
            params.push(`%${filters.q.trim()}%`);
            const i = params.length;
            where.push(`(
                t.id::text ILIKE $${i}
                OR t.subject ILIKE $${i}
                OR COALESCE(requester.email, '') ILIKE $${i}
                OR COALESCE(requester.name, '') ILIKE $${i}
            )`);
        }

        const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

        const [countRes, dataRes] = await Promise.all([
            this.pool.query(
                `SELECT COUNT(*)::int AS count
                 FROM support_tickets t
                 LEFT JOIN users requester ON requester.id = t.user_id
                 ${whereClause}`,
                params,
            ),
            this.pool.query(
                `SELECT t.*,
                        requester.email AS requester_email,
                        requester.name AS requester_name,
                        sa.agent_user_id,
                        agent.email AS agent_email,
                        agent.name AS agent_name,
                        (
                          SELECT COUNT(*)::int FROM support_messages m WHERE m.ticket_id = t.id
                        ) AS messages_count
                 FROM support_tickets t
                 LEFT JOIN users requester ON requester.id = t.user_id
                 LEFT JOIN support_assignments sa ON sa.ticket_id = t.id
                 LEFT JOIN users agent ON agent.id = sa.agent_user_id
                 ${whereClause}
                 ORDER BY t.last_reply_at DESC NULLS LAST, t.created_at DESC
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

    async getAdminTicket(ticketId: string) {
        return this.loadTicketDetails(ticketId);
    }

    async assignTicket(ticketId: string, agentUserId: string, reason: string, actorUserId: string, actorRole: string) {
        if (!reason?.trim()) {
            throw new BadRequestException('السبب مطلوب');
        }

        await this.getTicketById(ticketId);

        await this.pool.query(
            `INSERT INTO support_assignments (ticket_id, agent_user_id)
             VALUES ($1, $2)
             ON CONFLICT (ticket_id)
             DO UPDATE SET agent_user_id = EXCLUDED.agent_user_id,
                           assigned_at = NOW()`,
            [ticketId, agentUserId],
        );

        await this.auditService.log({
            actorUserId,
            actorRole,
            action: 'support.assign',
            entityType: 'support_ticket',
            entityId: ticketId,
            meta: { agentUserId, reason: reason.trim() },
        });

        return this.loadTicketDetails(ticketId);
    }

    async updateTicketStatus(ticketId: string, status: string, reason: string, actorUserId: string, actorRole: string) {
        if (!reason?.trim()) {
            throw new BadRequestException('السبب مطلوب');
        }

        const normalizedStatus = status.trim().toUpperCase();
        const allowed = new Set(['OPEN', 'PENDING', 'RESOLVED', 'CLOSED']);
        if (!allowed.has(normalizedStatus)) {
            throw new BadRequestException('قيمة status غير صالحة');
        }

        const { rows } = await this.pool.query(
            `UPDATE support_tickets
             SET status = $2,
                 last_reply_at = NOW()
             WHERE id = $1
             RETURNING *`,
            [ticketId, normalizedStatus],
        );
        if (rows.length === 0) throw new NotFoundException('التذكرة غير موجودة');

        await this.auditService.log({
            actorUserId,
            actorRole,
            action: 'support.status_update',
            entityType: 'support_ticket',
            entityId: ticketId,
            meta: { status: normalizedStatus, reason: reason.trim() },
        });

        return rows[0];
    }

    async addAdminMessage(ticketId: string, actorUserId: string, actorRole: string, message: string, attachments?: unknown) {
        await this.getTicketById(ticketId);

        const senderType = actorRole === 'ADMIN' || actorRole === 'SUPERADMIN' ? 'AGENT' : 'AGENT';

        await this.pool.query(
            `INSERT INTO support_messages (ticket_id, sender_type, sender_user_id, message, attachments)
             VALUES ($1, $2, $3, $4, $5::jsonb)`,
            [ticketId, senderType, actorUserId, message.trim(), JSON.stringify(attachments || [])],
        );

        await this.pool.query(
            `UPDATE support_tickets
             SET status = CASE WHEN status = 'OPEN' THEN 'PENDING' ELSE status END,
                 last_reply_at = NOW()
             WHERE id = $1`,
            [ticketId],
        );

        await this.auditService.log({
            actorUserId,
            actorRole,
            action: 'support.reply_admin',
            entityType: 'support_ticket',
            entityId: ticketId,
            meta: {},
        });

        return this.loadTicketDetails(ticketId);
    }

    private async getTicketById(ticketId: string) {
        const { rows } = await this.pool.query(
            'SELECT * FROM support_tickets WHERE id = $1',
            [ticketId],
        );
        if (rows.length === 0) throw new NotFoundException('التذكرة غير موجودة');
        return rows[0];
    }

    private async loadTicketDetails(ticketId: string) {
        const [ticketRes, messagesRes] = await Promise.all([
            this.pool.query(
                `SELECT t.*,
                        requester.email AS requester_email,
                        requester.name AS requester_name,
                        sa.agent_user_id,
                        agent.email AS agent_email,
                        agent.name AS agent_name
                 FROM support_tickets t
                 LEFT JOIN users requester ON requester.id = t.user_id
                 LEFT JOIN support_assignments sa ON sa.ticket_id = t.id
                 LEFT JOIN users agent ON agent.id = sa.agent_user_id
                 WHERE t.id = $1`,
                [ticketId],
            ),
            this.pool.query(
                `SELECT id, ticket_id, sender_type, sender_user_id, message, attachments, created_at
                 FROM support_messages
                 WHERE ticket_id = $1
                 ORDER BY created_at ASC`,
                [ticketId],
            ),
        ]);

        if (ticketRes.rows.length === 0) throw new NotFoundException('التذكرة غير موجودة');
        return {
            ...ticketRes.rows[0],
            messages: messagesRes.rows,
        };
    }
}
