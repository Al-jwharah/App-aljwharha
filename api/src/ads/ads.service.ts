import {
    Injectable,
    Inject,
    BadRequestException,
    NotFoundException,
    ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DATABASE_POOL } from '../database/database.module';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class AdsService {
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

    async listProducts() {
        const { rows } = await this.pool.query(
            `SELECT code, price_amount, currency, duration_days, created_at, updated_at
             FROM ad_products
             ORDER BY code ASC`,
        );
        return { items: rows };
    }

    async createCampaign(sellerId: string, listingId: string, rawProductCode: string) {
        const productCode = rawProductCode.trim().toUpperCase();

        const [{ rows: listingRows }, { rows: productRows }] = await Promise.all([
            this.pool.query('SELECT id, owner_id, status, is_sold FROM listings WHERE id = $1', [listingId]),
            this.pool.query('SELECT * FROM ad_products WHERE code = $1', [productCode]),
        ]);

        if (listingRows.length === 0) throw new NotFoundException('الإعلان غير موجود');
        if (productRows.length === 0) throw new NotFoundException('المنتج الإعلاني غير موجود');

        const listing = listingRows[0];
        if (listing.owner_id !== sellerId) throw new ForbiddenException('لا يمكنك ترويج إعلان لا تملكه');
        if (listing.status !== 'APPROVED' || listing.is_sold) {
            throw new BadRequestException('الإعلان غير مؤهل للترويج');
        }

        const { rows } = await this.pool.query(
            `INSERT INTO ad_campaigns (seller_id, listing_id, product_code, status)
             VALUES ($1, $2, $3, 'PENDING_PAYMENT')
             RETURNING *`,
            [sellerId, listingId, productCode],
        );

        await this.auditService.log({
            actorUserId: sellerId,
            action: 'ads.campaign_create',
            entityType: 'ad_campaign',
            entityId: rows[0].id,
            meta: { listingId, productCode },
        });

        return rows[0];
    }

    async payCampaign(campaignId: string, sellerId: string) {
        if (!this.tapSecretKey) {
            throw new BadRequestException('بوابة الدفع غير مُعدّة');
        }

        const { rows } = await this.pool.query(
            `SELECT c.*, p.price_amount, p.currency, p.duration_days
             FROM ad_campaigns c
             JOIN ad_products p ON p.code = c.product_code
             WHERE c.id = $1 AND c.seller_id = $2`,
            [campaignId, sellerId],
        );
        if (rows.length === 0) throw new NotFoundException('الحملة غير موجودة');

        const campaign = rows[0];

        if (campaign.status === 'ACTIVE') {
            return {
                campaignId,
                alreadyActive: true,
                startsAt: campaign.starts_at,
                endsAt: campaign.ends_at,
            };
        }

        if (campaign.tap_charge_id) {
            return {
                campaignId,
                chargeId: campaign.tap_charge_id,
                idempotent: true,
            };
        }

        const amount = Number(campaign.price_amount || 0);
        const currency = campaign.currency || 'SAR';

        const body = {
            amount,
            currency,
            customer_initiated: true,
            threeDSecure: true,
            save_card: false,
            description: `Ad campaign ${campaignId}`,
            metadata: { ad_campaign_id: campaignId, product_code: campaign.product_code },
            reference: {
                transaction: `ad-${campaignId.substring(0, 8)}-${Date.now()}`,
                order: campaignId,
            },
            receipt: { email: true, sms: false },
            merchant: { id: this.tapMerchantId || undefined },
            source: { id: 'src_all' },
            redirect: {
                url: `https://aljwharah.ai/seller?campaign=${campaignId}`,
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
            `UPDATE ad_campaigns
             SET tap_charge_id = $2,
                 status = 'PENDING_PAYMENT'
             WHERE id = $1`,
            [campaignId, data.id],
        );

        return {
            campaignId,
            chargeId: data.id,
            transactionUrl: data.transaction?.url || null,
            amount,
            currency,
        };
    }

    async handleTapWebhook(payload: any) {
        const campaignId = payload?.metadata?.ad_campaign_id as string | undefined;
        if (!campaignId) return null;

        const tapStatus = payload?.status as string | undefined;
        const chargeId = payload?.id as string | undefined;
        if (!tapStatus || !chargeId) return null;

        const client = await this.pool.connect();

        try {
            await client.query('BEGIN');

            const { rows } = await client.query(
                `SELECT c.*, p.duration_days
                 FROM ad_campaigns c
                 JOIN ad_products p ON p.code = c.product_code
                 WHERE c.id = $1
                 FOR UPDATE`,
                [campaignId],
            );
            if (rows.length === 0) {
                await client.query('COMMIT');
                return { handled: true, action: 'campaign_not_found' };
            }

            const campaign = rows[0];

            if (tapStatus === 'CAPTURED') {
                const startsAt = new Date();
                const endsAt = new Date(startsAt);
                endsAt.setDate(endsAt.getDate() + Number(campaign.duration_days || 1));

                await client.query(
                    `UPDATE ad_campaigns
                     SET status = 'ACTIVE',
                         tap_charge_id = $2,
                         starts_at = $3,
                         ends_at = $4
                     WHERE id = $1`,
                    [campaignId, chargeId, startsAt.toISOString(), endsAt.toISOString()],
                );

                await client.query('COMMIT');

                await this.auditService.log({
                    actorUserId: campaign.seller_id,
                    action: 'ads.campaign_activate',
                    entityType: 'ad_campaign',
                    entityId: campaignId,
                    meta: { chargeId, startsAt, endsAt },
                });

                return { handled: true, action: 'activated' };
            }

            if (['FAILED', 'CANCELLED', 'DECLINED', 'TIMEDOUT', 'ABANDONED'].includes(tapStatus)) {
                await client.query(
                    `UPDATE ad_campaigns
                     SET status = 'CANCELLED',
                         tap_charge_id = $2
                     WHERE id = $1`,
                    [campaignId, chargeId],
                );

                await client.query('COMMIT');
                await this.auditService.log({
                    actorUserId: campaign.seller_id,
                    action: 'ads.campaign_payment_failed',
                    entityType: 'ad_campaign',
                    entityId: campaignId,
                    meta: { chargeId, tapStatus },
                });

                return { handled: true, action: 'cancelled' };
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

    async listCampaignsForSeller(sellerId: string, page = 1, pageSize = 20) {
        const safePage = Math.max(1, page);
        const safePageSize = Math.max(1, Math.min(pageSize, 100));
        const offset = (safePage - 1) * safePageSize;

        const [countRes, dataRes] = await Promise.all([
            this.pool.query('SELECT COUNT(*)::int AS count FROM ad_campaigns WHERE seller_id = $1', [sellerId]),
            this.pool.query(
                `SELECT c.*, l.title, l.city, l.type
                 FROM ad_campaigns c
                 JOIN listings l ON l.id = c.listing_id
                 WHERE c.seller_id = $1
                 ORDER BY c.created_at DESC
                 LIMIT $2 OFFSET $3`,
                [sellerId, safePageSize, offset],
            ),
        ]);

        return {
            items: dataRes.rows,
            total: countRes.rows[0]?.count ?? 0,
            page: safePage,
            pageSize: safePageSize,
        };
    }

    async trackImpression(campaignId: string, page: string) {
        await this.pool.query(
            'INSERT INTO ad_impressions (campaign_id, page) VALUES ($1, $2)',
            [campaignId, page.substring(0, 120)],
        );
        return { tracked: true };
    }

    async trackClick(campaignId: string, page: string) {
        await this.pool.query(
            'INSERT INTO ad_clicks (campaign_id, page) VALUES ($1, $2)',
            [campaignId, page.substring(0, 120)],
        );
        return { tracked: true };
    }

    async getPlacements(page: string, limit = 12) {
        const safeLimit = Math.max(1, Math.min(limit, 50));
        const { rows } = await this.pool.query(
            `SELECT
                c.id,
                c.product_code,
                c.starts_at,
                c.ends_at,
                l.id AS listing_id,
                l.title,
                l.description,
                l.city,
                l.type,
                l.price,
                l.currency,
                u.name AS seller_name
             FROM ad_campaigns c
             JOIN listings l ON l.id = c.listing_id
             LEFT JOIN users u ON u.id = c.seller_id
             WHERE c.status = 'ACTIVE'
               AND c.starts_at <= NOW()
               AND c.ends_at > NOW()
               AND l.status = 'APPROVED'
             ORDER BY c.created_at DESC
             LIMIT $1`,
            [safeLimit],
        );

        // Server-side tracking can be called by backend-rendered surfaces.
        for (const row of rows) {
            await this.pool.query(
                'INSERT INTO ad_impressions (campaign_id, page) VALUES ($1, $2)',
                [row.id, page.substring(0, 120)],
            );
        }

        return { items: rows };
    }

    async expireCampaigns(limit = 200) {
        const { rows } = await this.pool.query(
            `UPDATE ad_campaigns
             SET status = 'EXPIRED'
             WHERE status = 'ACTIVE'
               AND ends_at <= NOW()
             RETURNING id`,
        );

        for (const row of rows.slice(0, limit)) {
            await this.auditService.log({
                action: 'ads.campaign_expire',
                entityType: 'ad_campaign',
                entityId: row.id,
                meta: {},
            });
        }

        return { expired: rows.length };
    }

    async listCampaignsAdmin(filters: {
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
            where.push(`c.status = $${params.length}`);
        }

        if (filters.q?.trim()) {
            params.push(`%${filters.q.trim()}%`);
            const i = params.length;
            where.push(`(
                c.id::text ILIKE $${i}
                OR c.seller_id::text ILIKE $${i}
                OR l.title ILIKE $${i}
                OR COALESCE(c.tap_charge_id, '') ILIKE $${i}
            )`);
        }

        const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

        const [countRes, dataRes] = await Promise.all([
            this.pool.query(
                `SELECT COUNT(*)::int AS count
                 FROM ad_campaigns c
                 JOIN listings l ON l.id = c.listing_id
                 ${whereClause}`,
                params,
            ),
            this.pool.query(
                `SELECT c.*, l.title, u.email AS seller_email, u.name AS seller_name
                 FROM ad_campaigns c
                 JOIN listings l ON l.id = c.listing_id
                 LEFT JOIN users u ON u.id = c.seller_id
                 ${whereClause}
                 ORDER BY c.created_at DESC
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

    async updateProduct(code: string, fields: { price_amount?: number; currency?: string; duration_days?: number }, actorUserId: string) {
        const updates: string[] = [];
        const params: any[] = [code.toUpperCase()];

        if (fields.price_amount !== undefined) {
            params.push(fields.price_amount);
            updates.push(`price_amount = $${params.length}`);
        }

        if (fields.currency !== undefined) {
            params.push(fields.currency.toUpperCase());
            updates.push(`currency = $${params.length}`);
        }

        if (fields.duration_days !== undefined) {
            params.push(fields.duration_days);
            updates.push(`duration_days = $${params.length}`);
        }

        if (updates.length === 0) throw new BadRequestException('لا توجد تغييرات للتحديث');

        const { rows } = await this.pool.query(
            `UPDATE ad_products
             SET ${updates.join(', ')}
             WHERE code = $1
             RETURNING *`,
            params,
        );

        if (rows.length === 0) throw new NotFoundException('المنتج الإعلاني غير موجود');

        await this.auditService.log({
            actorUserId,
            actorRole: 'ADMIN',
            action: 'ads.product_update',
            entityType: 'ad_product',
            entityId: code.toUpperCase(),
            meta: fields,
        });

        return rows[0];
    }
}
