import {
    Injectable,
    Inject,
    BadRequestException,
    NotFoundException,
    ConflictException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DATABASE_POOL } from '../database/database.module';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class PlansService {
    private readonly tapUrl = 'https://api.tap.company/v2';
    private readonly tapSecretKey: string;
    private readonly tapMerchantId: string;

    constructor(
        @Inject(DATABASE_POOL) private readonly pool: any,
        private readonly configService: ConfigService,
        private readonly auditService: AuditService,
    ) {
        this.tapSecretKey = this.configService.get<string>('TAP_SECRET_KEY') || '';
        this.tapMerchantId = this.configService.get<string>('TAP_MERCHANT_ID') || '';
    }

    async getPlans() {
        const { rows } = await this.pool.query(
            `SELECT code, title_ar, title_en, price_amount, currency, period,
                    commission_bps_override, listing_limit, auction_limit, ad_credit_amount, support_sla
             FROM plans
             ORDER BY CASE code WHEN 'FREE' THEN 1 WHEN 'PRO' THEN 2 ELSE 3 END`,
        );
        return { items: rows };
    }

    async getMySubscription(userId: string) {
        const [subResult, usage] = await Promise.all([
            this.pool.query(
                `SELECT s.*, p.title_ar, p.title_en, p.price_amount, p.currency, p.period,
                        p.commission_bps_override, p.listing_limit, p.auction_limit, p.ad_credit_amount, p.support_sla
                 FROM subscriptions s
                 JOIN plans p ON p.code = s.plan_code
                 WHERE s.user_id = $1
                 ORDER BY s.current_period_end DESC, s.created_at DESC
                 LIMIT 1`,
                [userId],
            ),
            this.getUsage(userId),
        ]);

        return {
            subscription: subResult.rows[0] || null,
            usage,
        };
    }

    async createSubscription(userId: string, rawPlanCode: string) {
        const planCode = rawPlanCode.trim().toUpperCase();
        const { rows: planRows } = await this.pool.query(
            'SELECT * FROM plans WHERE code = $1',
            [planCode],
        );
        if (planRows.length === 0) throw new NotFoundException('الباقة غير موجودة');

        const plan = planRows[0];

        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');

            // Keep history but close currently active subscriptions.
            await client.query(
                `UPDATE subscriptions
                 SET status = 'CANCELLED'
                 WHERE user_id = $1
                   AND status = 'ACTIVE'
                   AND current_period_end > NOW()`,
                [userId],
            );

            const start = new Date();
            const end = this.computePeriodEnd(start, plan.period);
            const status = Number(plan.price_amount) > 0 ? 'PAST_DUE' : 'ACTIVE';

            const { rows } = await client.query(
                `INSERT INTO subscriptions (
                    user_id,
                    plan_code,
                    status,
                    current_period_start,
                    current_period_end
                 ) VALUES ($1, $2, $3, $4, $5)
                 RETURNING *`,
                [userId, plan.code, status, start.toISOString(), end.toISOString()],
            );

            await client.query('COMMIT');

            await this.auditService.log({
                actorUserId: userId,
                action: 'subscription.create',
                entityType: 'subscription',
                entityId: rows[0].id,
                meta: { planCode: plan.code, status },
            });

            return {
                subscription: rows[0],
                requiresPayment: Number(plan.price_amount) > 0,
                plan,
            };
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    }

    async createSubscriptionPayment(subscriptionId: string, userId: string) {
        const { rows } = await this.pool.query(
            `SELECT s.*, p.price_amount, p.currency, p.period, p.code AS plan_code
             FROM subscriptions s
             JOIN plans p ON p.code = s.plan_code
             WHERE s.id = $1 AND s.user_id = $2`,
            [subscriptionId, userId],
        );
        if (rows.length === 0) throw new NotFoundException('الاشتراك غير موجود');

        const sub = rows[0];
        const amount = Number(sub.price_amount || 0);
        if (amount <= 0) {
            throw new BadRequestException('هذه الباقة لا تحتاج دفعًا');
        }
        if (!this.tapSecretKey) {
            throw new BadRequestException('بوابة الدفع غير مُعدّة');
        }

        if (sub.status === 'ACTIVE' && new Date(sub.current_period_end) > new Date()) {
            return {
                subscriptionId,
                alreadyActive: true,
                currentPeriodEnd: sub.current_period_end,
            };
        }

        if (sub.pending_tap_charge_id) {
            return {
                subscriptionId,
                chargeId: sub.pending_tap_charge_id,
                idempotent: true,
            };
        }

        const body = {
            amount,
            currency: sub.currency || 'SAR',
            customer_initiated: true,
            threeDSecure: true,
            save_card: false,
            description: `Aljwharah Subscription ${sub.plan_code}`,
            metadata: { subscription_id: sub.id, plan_code: sub.plan_code },
            reference: {
                transaction: `sub-${sub.id.substring(0, 8)}-${Date.now()}`,
                order: sub.id,
            },
            receipt: { email: true, sms: false },
            merchant: { id: this.tapMerchantId || undefined },
            source: { id: 'src_all' },
            redirect: {
                url: `https://aljwharah.ai/pricing?subscription=${sub.id}`,
            },
        };

        const res = await fetch(`${this.tapUrl}/charges`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${this.tapSecretKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        });

        const data = await res.json();
        if (!res.ok) {
            throw new BadRequestException(data.errors?.[0]?.description || 'فشل إنشاء عملية الدفع');
        }

        await this.pool.query(
            `UPDATE subscriptions
             SET pending_tap_charge_id = $1,
                 status = 'PAST_DUE'
             WHERE id = $2`,
            [data.id, subscriptionId],
        );

        await this.auditService.log({
            actorUserId: userId,
            action: 'subscription.pay',
            entityType: 'subscription',
            entityId: subscriptionId,
            meta: { chargeId: data.id, amount, currency: sub.currency },
        });

        return {
            subscriptionId,
            chargeId: data.id,
            transactionUrl: data.transaction?.url || null,
            amount,
            currency: sub.currency,
        };
    }

    async handleTapWebhook(payload: any) {
        const subscriptionId = payload?.metadata?.subscription_id as string | undefined;
        if (!subscriptionId) return null;

        const tapStatus = payload?.status as string | undefined;
        const chargeId = payload?.id as string | undefined;
        if (!tapStatus || !chargeId) return null;

        const client = await this.pool.connect();

        try {
            await client.query('BEGIN');
            const { rows } = await client.query(
                `SELECT s.*, p.code AS plan_code, p.price_amount, p.currency, p.period
                 FROM subscriptions s
                 JOIN plans p ON p.code = s.plan_code
                 WHERE s.id = $1
                 FOR UPDATE`,
                [subscriptionId],
            );

            if (rows.length === 0) {
                await client.query('COMMIT');
                return { handled: true, action: 'subscription_not_found' };
            }

            const sub = rows[0];
            const amount = Number(sub.price_amount || 0);
            const currency = sub.currency || 'SAR';

            if (tapStatus === 'CAPTURED') {
                const now = new Date();
                const periodStart = now;
                const periodEnd = this.computePeriodEnd(now, sub.period);

                await client.query(
                    `UPDATE subscriptions
                     SET status = 'ACTIVE',
                         current_period_start = $2,
                         current_period_end = $3,
                         pending_tap_charge_id = NULL
                     WHERE id = $1`,
                    [subscriptionId, periodStart.toISOString(), periodEnd.toISOString()],
                );

                const invoiceNo = await this.nextSubscriptionInvoiceNo(client);
                await client.query(
                    `INSERT INTO subscription_invoices (
                        subscription_id, invoice_no, amount, currency, status, tap_charge_id,
                        period_start, period_end
                     ) VALUES ($1, $2, $3, $4, 'PAID', $5, $6, $7)
                     ON CONFLICT (tap_charge_id) DO NOTHING`,
                    [
                        subscriptionId,
                        invoiceNo,
                        amount,
                        currency,
                        chargeId,
                        periodStart.toISOString(),
                        periodEnd.toISOString(),
                    ],
                );

                await client.query('COMMIT');

                await this.auditService.log({
                    actorUserId: sub.user_id,
                    action: 'subscription.activate',
                    entityType: 'subscription',
                    entityId: subscriptionId,
                    meta: { chargeId, invoiceNo, amount, currency },
                });

                return { handled: true, action: 'activated' };
            }

            if (['FAILED', 'CANCELLED', 'DECLINED', 'TIMEDOUT', 'ABANDONED'].includes(tapStatus)) {
                await client.query(
                    `UPDATE subscriptions
                     SET status = 'PAST_DUE', pending_tap_charge_id = NULL
                     WHERE id = $1`,
                    [subscriptionId],
                );

                const invoiceNo = await this.nextSubscriptionInvoiceNo(client);
                await client.query(
                    `INSERT INTO subscription_invoices (
                        subscription_id, invoice_no, amount, currency, status, tap_charge_id,
                        period_start, period_end
                     ) VALUES ($1, $2, $3, $4, 'FAILED', $5, NOW(), NOW())
                     ON CONFLICT (tap_charge_id) DO NOTHING`,
                    [subscriptionId, invoiceNo, amount, currency, chargeId],
                );

                await client.query('COMMIT');

                await this.auditService.log({
                    actorUserId: sub.user_id,
                    action: 'subscription.pay_failed',
                    entityType: 'subscription',
                    entityId: subscriptionId,
                    meta: { chargeId, tapStatus, amount, currency },
                });

                return { handled: true, action: 'past_due' };
            }

            await client.query('COMMIT');
            return { handled: true, action: 'ignored_status', tapStatus };
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    }

    async assertListingAllowed(userId: string) {
        const plan = await this.getEffectivePlanForUser(userId);
        const { rows } = await this.pool.query(
            `SELECT COUNT(*)::int AS count
             FROM listings
             WHERE owner_id = $1`,
            [userId],
        );
        const used = rows[0]?.count ?? 0;
        if (used >= Number(plan.listing_limit)) {
            throw new ConflictException(`تجاوزت حد الإعلانات في باقتك (${plan.listing_limit})`);
        }
        return { used, limit: Number(plan.listing_limit), planCode: plan.code };
    }

    async assertAuctionPublishAllowed(userId: string) {
        const plan = await this.getEffectivePlanForUser(userId);
        const { rows } = await this.pool.query(
            `SELECT COUNT(*)::int AS count
             FROM auctions
             WHERE seller_id = $1
               AND status IN ('DRAFT', 'LIVE')`,
            [userId],
        );
        const used = rows[0]?.count ?? 0;
        if (used >= Number(plan.auction_limit)) {
            throw new ConflictException(`تجاوزت حد المزادات في باقتك (${plan.auction_limit})`);
        }
        return { used, limit: Number(plan.auction_limit), planCode: plan.code };
    }

    async getCommissionBpsForUser(userId: string, defaultCommissionBps: number) {
        const plan = await this.getEffectivePlanForUser(userId);
        if (plan.commission_bps_override !== null && plan.commission_bps_override !== undefined) {
            return Number(plan.commission_bps_override);
        }
        return defaultCommissionBps;
    }

    async getEffectivePlanForUser(userId: string) {
        const { rows } = await this.pool.query(
            `SELECT p.*
             FROM subscriptions s
             JOIN plans p ON p.code = s.plan_code
             WHERE s.user_id = $1
               AND s.status = 'ACTIVE'
               AND s.current_period_end > NOW()
             ORDER BY s.current_period_end DESC
             LIMIT 1`,
            [userId],
        );

        if (rows.length > 0) return rows[0];

        const { rows: freeRows } = await this.pool.query('SELECT * FROM plans WHERE code = $1', ['FREE']);
        if (freeRows.length === 0) {
            throw new NotFoundException('تعذر العثور على باقة FREE');
        }
        return freeRows[0];
    }

    private async getUsage(userId: string) {
        const [listingsRes, auctionsRes] = await Promise.all([
            this.pool.query('SELECT COUNT(*)::int AS count FROM listings WHERE owner_id = $1', [userId]),
            this.pool.query(
                `SELECT COUNT(*)::int AS count
                 FROM auctions
                 WHERE seller_id = $1
                   AND status IN ('DRAFT', 'LIVE')`,
                [userId],
            ),
        ]);

        return {
            listings: listingsRes.rows[0]?.count ?? 0,
            auctions: auctionsRes.rows[0]?.count ?? 0,
        };
    }

    private computePeriodEnd(start: Date, period: string) {
        const end = new Date(start);
        if ((period || '').toUpperCase() === 'YEARLY') {
            end.setFullYear(end.getFullYear() + 1);
        } else {
            end.setMonth(end.getMonth() + 1);
        }
        return end;
    }

    private async nextSubscriptionInvoiceNo(client: any) {
        const year = new Date().getFullYear();
        const { rows } = await client.query(
            `INSERT INTO subscription_invoice_sequences (year, last_no)
             VALUES ($1, 1)
             ON CONFLICT (year)
             DO UPDATE SET last_no = subscription_invoice_sequences.last_no + 1
             RETURNING last_no`,
            [year],
        );

        return `SUB-${year}-${String(rows[0].last_no).padStart(6, '0')}`;
    }
}
