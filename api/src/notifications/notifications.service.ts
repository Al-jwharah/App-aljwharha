import { Injectable, Inject, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DATABASE_POOL } from '../database/database.module';

type QueueEmailInput = {
    eventType: string;
    recipient: string;
    subject: string;
    bodyText: string;
    bodyHtml?: string;
    payload?: Record<string, unknown>;
};

@Injectable()
export class NotificationsService {
    private readonly logger = new Logger(NotificationsService.name);

    constructor(
        @Inject(DATABASE_POOL) private readonly pool: any,
        private readonly configService: ConfigService,
    ) { }

    async queueEmail(input: QueueEmailInput): Promise<void> {
        await this.pool.query(
            `INSERT INTO notifications_outbox (event_type, recipient, subject, body_text, body_html, payload)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [
                input.eventType,
                input.recipient,
                input.subject,
                input.bodyText,
                input.bodyHtml || null,
                JSON.stringify(input.payload || {}),
            ],
        );

        // Fire-and-forget local dispatcher; failures are persisted in outbox.
        setImmediate(() => {
            this.processOutboxBatch(5).catch((err) => {
                this.logger.warn(`Outbox dispatch deferred: ${(err as Error).message}`);
            });
        });
    }

    async queueForUser(
        userId: string,
        eventType: string,
        subject: string,
        bodyText: string,
        payload: Record<string, unknown> = {},
    ): Promise<void> {
        const { rows } = await this.pool.query('SELECT email FROM users WHERE id = $1', [userId]);
        if (rows.length === 0 || !rows[0].email) return;

        await this.queueEmail({
            eventType,
            recipient: rows[0].email,
            subject,
            bodyText,
            payload,
        });
    }

    async notifyOrderCreated(userId: string, orderId: string, totalAmount: number, currency: string, reservedUntil?: string | null) {
        await this.queueForUser(
            userId,
            'order.created',
            'تم إنشاء طلبك بنجاح',
            `تم إنشاء الطلب ${orderId}. الإجمالي: ${totalAmount} ${currency}.${reservedUntil ? ` الحجز ساري حتى ${new Date(reservedUntil).toLocaleString('ar-SA')}.` : ''}`,
            { orderId, totalAmount, currency, reservedUntil },
        );
    }

    async notifyPaymentCaptured(userId: string, orderId: string, totalAmount: number, currency: string) {
        await this.queueForUser(
            userId,
            'payment.captured',
            'تم تأكيد الدفع',
            `تم الدفع بنجاح للطلب ${orderId} بقيمة ${totalAmount} ${currency}.`,
            { orderId, totalAmount, currency },
        );
    }

    async notifyPaymentFailed(userId: string, orderId: string) {
        await this.queueForUser(
            userId,
            'payment.failed',
            'فشل عملية الدفع',
            `فشلت عملية الدفع للطلب ${orderId} وتم إلغاء الحجز المرتبط.`,
            { orderId },
        );
    }

    async notifyReservationExpired(userId: string, orderId: string) {
        await this.queueForUser(
            userId,
            'reservation.expired',
            'انتهت مهلة الحجز',
            `انتهت مهلة الحجز للطلب ${orderId}. يمكنك إنشاء طلب جديد عند الحاجة.`,
            { orderId },
        );
    }

    async notifyPayoutApproved(userId: string, payoutId: string, amount: number) {
        await this.queueForUser(
            userId,
            'payout.approved',
            'تمت الموافقة على طلب السحب',
            `تمت الموافقة على طلب السحب ${payoutId} بقيمة ${amount} ر.س.`,
            { payoutId, amount },
        );
    }

    async processOutboxBatch(limit = 20) {
        const { rows } = await this.pool.query(
            `SELECT id, event_type, recipient, subject, body_text, body_html, payload, attempts
             FROM notifications_outbox
             WHERE status = 'PENDING'
             ORDER BY created_at ASC
             LIMIT $1`,
            [Math.max(1, Math.min(limit, 100))],
        );

        let sent = 0;
        let failed = 0;

        for (const row of rows) {
            try {
                await this.sendProviderEmail(row.recipient, row.subject, row.body_text, row.body_html);
                await this.pool.query(
                    `UPDATE notifications_outbox
                     SET status = 'SENT', sent_at = NOW(), last_error = NULL
                     WHERE id = $1`,
                    [row.id],
                );
                sent += 1;
            } catch (err) {
                const nextAttempts = Number(row.attempts || 0) + 1;
                const terminal = nextAttempts >= 5;
                await this.pool.query(
                    `UPDATE notifications_outbox
                     SET attempts = $2,
                         status = $3,
                         last_error = $4
                     WHERE id = $1`,
                    [row.id, nextAttempts, terminal ? 'FAILED' : 'PENDING', this.sanitizeError((err as Error).message)],
                );
                failed += 1;
            }
        }

        return { checked: rows.length, sent, failed };
    }

    private async sendProviderEmail(recipient: string, subject: string, bodyText: string, bodyHtml?: string | null) {
        const provider = (this.configService.get<string>('EMAIL_PROVIDER') || 'RESEND').toUpperCase();

        if (provider === 'SENDGRID') {
            return this.sendWithSendGrid(recipient, subject, bodyText, bodyHtml);
        }

        return this.sendWithResend(recipient, subject, bodyText, bodyHtml);
    }

    private async sendWithResend(recipient: string, subject: string, bodyText: string, bodyHtml?: string | null) {
        const apiKey = this.configService.get<string>('RESEND_API_KEY') || '';
        const from = this.configService.get<string>('EMAIL_FROM') || 'Aljwharah <no-reply@aljwharah.ai>';

        if (!apiKey) {
            throw new Error('RESEND_API_KEY is not configured');
        }

        const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                from,
                to: [recipient],
                subject,
                text: bodyText,
                html: bodyHtml || undefined,
            }),
        });

        if (!response.ok) {
            const text = await response.text();
            throw new Error(`Resend API error (${response.status}) ${text.substring(0, 300)}`);
        }
    }

    private async sendWithSendGrid(recipient: string, subject: string, bodyText: string, bodyHtml?: string | null) {
        const apiKey = this.configService.get<string>('SENDGRID_API_KEY') || '';
        const from = this.configService.get<string>('EMAIL_FROM') || 'no-reply@aljwharah.ai';

        if (!apiKey) {
            throw new Error('SENDGRID_API_KEY is not configured');
        }

        const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                personalizations: [{ to: [{ email: recipient }] }],
                from: { email: from },
                subject,
                content: [
                    { type: 'text/plain', value: bodyText },
                    ...(bodyHtml ? [{ type: 'text/html', value: bodyHtml }] : []),
                ],
            }),
        });

        if (!response.ok) {
            const text = await response.text();
            throw new Error(`SendGrid API error (${response.status}) ${text.substring(0, 300)}`);
        }
    }

    private sanitizeError(message: string): string {
        return message.substring(0, 500);
    }
}