import {
    Injectable,
    Inject,
    NotFoundException,
    BadRequestException,
    ForbiddenException,
    ConflictException,
} from '@nestjs/common';
import { DATABASE_POOL } from '../database/database.module';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PlansService } from '../plans/plans.service';
import { CreateAuctionDto } from './dto/create-auction.dto';

@Injectable()
export class AuctionsService {
    constructor(
        @Inject(DATABASE_POOL) private readonly pool: any,
        private readonly auditService: AuditService,
        private readonly notificationsService: NotificationsService,
        private readonly plansService: PlansService,
    ) { }

    async createDraft(sellerId: string, dto: CreateAuctionDto) {
        const startsAt = new Date(dto.startsAt);
        const endsAt = new Date(dto.endsAt);
        if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime()) || endsAt <= startsAt) {
            throw new BadRequestException('توقيت المزاد غير صالح');
        }

        const { rows: listingRows } = await this.pool.query(
            `SELECT id, owner_id, status, is_sold, reserved_by_order_id
             FROM listings
             WHERE id = $1`,
            [dto.listingId],
        );
        if (listingRows.length === 0) throw new NotFoundException('الإعلان غير موجود');

        const listing = listingRows[0];
        if (listing.owner_id !== sellerId) {
            throw new ForbiddenException('لا يمكنك إنشاء مزاد على إعلان لا تملكه');
        }
        if (listing.status !== 'APPROVED' || listing.is_sold || listing.reserved_by_order_id) {
            throw new BadRequestException('الإعلان غير متاح للمزاد حالياً');
        }

        const { rows } = await this.pool.query(
            `INSERT INTO auctions (
                listing_id,
                seller_id,
                starts_at,
                ends_at,
                status,
                starting_price,
                bid_increment,
                reserve_price,
                buy_now_price,
                anti_sniping_seconds,
                current_price
             ) VALUES (
                $1, $2, $3, $4, 'DRAFT', $5, $6, $7, $8, $9, $5
             )
             RETURNING *`,
            [
                dto.listingId,
                sellerId,
                startsAt.toISOString(),
                endsAt.toISOString(),
                dto.startingPrice,
                dto.bidIncrement,
                dto.reservePrice ?? null,
                dto.buyNowPrice ?? null,
                dto.antiSnipingSeconds ?? 120,
            ],
        );

        await this.auditService.log({
            actorUserId: sellerId,
            action: 'auction.create',
            entityType: 'auction',
            entityId: rows[0].id,
            meta: { listingId: dto.listingId },
        });

        return rows[0];
    }

    async publishAuction(auctionId: string, sellerId: string) {
        await this.plansService.assertAuctionPublishAllowed(sellerId);

        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');

            const { rows } = await client.query(
                'SELECT * FROM auctions WHERE id = $1 FOR UPDATE',
                [auctionId],
            );
            if (rows.length === 0) throw new NotFoundException('المزاد غير موجود');
            const auction = rows[0];

            if (auction.seller_id !== sellerId) {
                throw new ForbiddenException('لا يمكنك نشر مزاد لا تملكه');
            }
            if (auction.status !== 'DRAFT') {
                throw new ConflictException('لا يمكن نشر المزاد بهذه الحالة');
            }

            const now = new Date();
            const startsAt = new Date(auction.starts_at);
            const effectiveStart = startsAt > now ? startsAt : now;
            const effectiveEnd = new Date(auction.ends_at);
            if (effectiveEnd <= effectiveStart) {
                throw new BadRequestException('وقت النهاية يجب أن يكون بعد البداية');
            }

            const { rows: updatedRows } = await client.query(
                `UPDATE auctions
                 SET status = 'LIVE', starts_at = $2
                 WHERE id = $1
                 RETURNING *`,
                [auctionId, effectiveStart.toISOString()],
            );

            await client.query('COMMIT');

            await this.auditService.log({
                actorUserId: sellerId,
                action: 'auction.publish',
                entityType: 'auction',
                entityId: auctionId,
                meta: { startsAt: effectiveStart.toISOString() },
            });

            return updatedRows[0];
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    }

    async cancelAuction(auctionId: string, sellerId: string) {
        const { rows } = await this.pool.query(
            `UPDATE auctions
             SET status = 'CANCELLED'
             WHERE id = $1
               AND seller_id = $2
               AND status = 'DRAFT'
             RETURNING *`,
            [auctionId, sellerId],
        );

        if (rows.length === 0) {
            throw new BadRequestException('يمكن إلغاء المزاد فقط قبل أن يصبح LIVE');
        }

        await this.auditService.log({
            actorUserId: sellerId,
            action: 'auction.cancel',
            entityType: 'auction',
            entityId: auctionId,
            meta: {},
        });

        return rows[0];
    }

    async listAuctions(filters: {
        status?: string;
        q?: string;
        sellerId?: string;
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
            where.push(`a.status = $${params.length}`);
        }

        if (filters.sellerId?.trim()) {
            params.push(filters.sellerId.trim());
            where.push(`a.seller_id = $${params.length}`);
        }

        if (filters.q?.trim()) {
            params.push(`%${filters.q.trim()}%`);
            const i = params.length;
            where.push(`(l.title ILIKE $${i} OR l.description ILIKE $${i} OR a.id::text ILIKE $${i})`);
        }

        const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

        const [countRes, dataRes] = await Promise.all([
            this.pool.query(
                `SELECT COUNT(*)::int AS count
                 FROM auctions a
                 JOIN listings l ON l.id = a.listing_id
                 ${whereClause}`,
                params,
            ),
            this.pool.query(
                `SELECT
                    a.*,
                    l.title,
                    l.description,
                    l.city,
                    l.type,
                    l.currency,
                    COALESCE(stats.bid_count, 0) AS bid_count,
                    stats.top_bid,
                    stats.top_bidder,
                    aw.winner_user_id,
                    aw.amount AS winning_amount,
                    aw.order_id
                 FROM auctions a
                 JOIN listings l ON l.id = a.listing_id
                 LEFT JOIN LATERAL (
                    SELECT
                      COUNT(*)::int AS bid_count,
                      MAX(b.amount) AS top_bid,
                      (ARRAY_AGG(b.user_id ORDER BY b.amount DESC, b.created_at ASC))[1] AS top_bidder
                    FROM bids b
                    WHERE b.auction_id = a.id
                 ) AS stats ON true
                 LEFT JOIN auction_winners aw ON aw.auction_id = a.id
                 ${whereClause}
                 ORDER BY a.created_at DESC
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

    async getAuction(auctionId: string, userId?: string) {
        const { rows } = await this.pool.query(
            `SELECT
                a.*,
                l.title,
                l.description,
                l.city,
                l.type,
                l.currency,
                COALESCE(stats.bid_count, 0) AS bid_count,
                stats.top_bid,
                stats.top_bidder,
                aw.winner_user_id,
                aw.amount AS winning_amount,
                aw.order_id
             FROM auctions a
             JOIN listings l ON l.id = a.listing_id
             LEFT JOIN LATERAL (
                SELECT
                  COUNT(*)::int AS bid_count,
                  MAX(b.amount) AS top_bid,
                  (ARRAY_AGG(b.user_id ORDER BY b.amount DESC, b.created_at ASC))[1] AS top_bidder
                FROM bids b
                WHERE b.auction_id = a.id
             ) AS stats ON true
             LEFT JOIN auction_winners aw ON aw.auction_id = a.id
             WHERE a.id = $1`,
            [auctionId],
        );

        if (rows.length === 0) throw new NotFoundException('المزاد غير موجود');
        const auction = rows[0];

        const myBid = userId
            ? await this.pool.query(
                `SELECT MAX(amount) AS max_amount
                 FROM bids
                 WHERE auction_id = $1 AND user_id = $2`,
                [auctionId, userId],
            )
            : null;

        return {
            ...auction,
            my_max_bid: myBid ? Number(myBid.rows[0]?.max_amount || 0) : null,
        };
    }

    async placeBid(auctionId: string, userId: string, rawAmount: number) {
        const amount = Number(rawAmount);
        if (!Number.isFinite(amount) || amount <= 0) {
            throw new BadRequestException('قيمة المزايدة غير صالحة');
        }

        const client = await this.pool.connect();

        try {
            await client.query('BEGIN');
            await client.query('SET TRANSACTION ISOLATION LEVEL SERIALIZABLE');

            const { rows: auctionRows } = await client.query(
                'SELECT * FROM auctions WHERE id = $1 FOR UPDATE',
                [auctionId],
            );
            if (auctionRows.length === 0) throw new NotFoundException('المزاد غير موجود');

            const auction = auctionRows[0];
            if (auction.status !== 'LIVE') {
                throw new BadRequestException('المزاد غير متاح للمزايدة الآن');
            }
            if (auction.seller_id === userId) {
                throw new BadRequestException('لا يمكنك المزايدة على مزادك');
            }

            const now = new Date();
            if (new Date(auction.ends_at) <= now) {
                throw new BadRequestException('انتهى وقت المزاد');
            }

            const { rows: topBidRows } = await client.query(
                `SELECT amount
                 FROM bids
                 WHERE auction_id = $1
                 ORDER BY amount DESC, created_at ASC
                 LIMIT 1`,
                [auctionId],
            );

            const topBid = topBidRows.length > 0 ? Number(topBidRows[0].amount) : null;
            const minBid = topBid === null
                ? Number(auction.starting_price)
                : topBid + Number(auction.bid_increment);

            if (amount < minBid) {
                throw new BadRequestException(`الحد الأدنى للمزايدة التالية هو ${minBid.toFixed(2)}`);
            }

            const { rows: bidRows } = await client.query(
                `INSERT INTO bids (auction_id, user_id, amount)
                 VALUES ($1, $2, $3)
                 RETURNING *`,
                [auctionId, userId, amount],
            );

            let newEndAt = new Date(auction.ends_at);
            const remainingSeconds = Math.floor((newEndAt.getTime() - now.getTime()) / 1000);
            const antiSnipingSeconds = Number(auction.anti_sniping_seconds || 0);
            if (antiSnipingSeconds > 0 && remainingSeconds <= antiSnipingSeconds) {
                newEndAt = new Date(newEndAt.getTime() + antiSnipingSeconds * 1000);
            }

            await client.query(
                `UPDATE auctions
                 SET current_price = $2,
                     ends_at = $3
                 WHERE id = $1`,
                [auctionId, amount, newEndAt.toISOString()],
            );

            let autoClosed = false;
            if (auction.buy_now_price && amount >= Number(auction.buy_now_price)) {
                await client.query(
                    `UPDATE auctions
                     SET status = 'ENDED', ends_at = NOW(), current_price = $2
                     WHERE id = $1`,
                    [auctionId, amount],
                );
                autoClosed = true;
            }

            await client.query('COMMIT');

            await this.auditService.log({
                actorUserId: userId,
                action: 'bid.place',
                entityType: 'auction',
                entityId: auctionId,
                meta: { amount, minBid, autoClosed },
            });

            if (autoClosed) {
                await this.closeEndedAuctions(1);
            }

            return {
                bid: bidRows[0],
                minNextBid: Number(amount) + Number(auction.bid_increment),
                extendedUntil: newEndAt.toISOString(),
                autoClosed,
            };
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    }

    async listUserBids(userId: string, page = 1, pageSize = 20) {
        const safePage = Math.max(1, page);
        const safePageSize = Math.max(1, Math.min(pageSize, 100));
        const offset = (safePage - 1) * safePageSize;

        const [countRes, dataRes] = await Promise.all([
            this.pool.query('SELECT COUNT(*)::int AS count FROM bids WHERE user_id = $1', [userId]),
            this.pool.query(
                `SELECT b.id, b.auction_id, b.amount, b.created_at,
                        a.status AS auction_status, a.ends_at, a.current_price,
                        l.title, l.city, l.type,
                        aw.winner_user_id, aw.order_id
                 FROM bids b
                 JOIN auctions a ON a.id = b.auction_id
                 JOIN listings l ON l.id = a.listing_id
                 LEFT JOIN auction_winners aw ON aw.auction_id = a.id
                 WHERE b.user_id = $1
                 ORDER BY b.created_at DESC
                 LIMIT $2 OFFSET $3`,
                [userId, safePageSize, offset],
            ),
        ]);

        return {
            items: dataRes.rows,
            total: countRes.rows[0]?.count ?? 0,
            page: safePage,
            pageSize: safePageSize,
        };
    }

    async closeEndedAuctions(limit = 50) {
        const client = await this.pool.connect();
        const processed: Array<{ auctionId: string; winnerUserId?: string; orderId?: string }> = [];

        try {
            await client.query('BEGIN');

            const { rows: auctions } = await client.query(
                `SELECT *
                 FROM auctions
                 WHERE status = 'LIVE'
                   AND ends_at <= NOW()
                 ORDER BY ends_at ASC
                 LIMIT $1
                 FOR UPDATE SKIP LOCKED`,
                [Math.max(1, Math.min(limit, 200))],
            );

            for (const auction of auctions) {
                const { rows: winnerRows } = await client.query(
                    `SELECT id, user_id, amount
                     FROM bids
                     WHERE auction_id = $1
                     ORDER BY amount DESC, created_at ASC
                     LIMIT 1`,
                    [auction.id],
                );

                await client.query(
                    `UPDATE auctions
                     SET status = 'ENDED'
                     WHERE id = $1`,
                    [auction.id],
                );

                if (winnerRows.length === 0) {
                    processed.push({ auctionId: auction.id });
                    continue;
                }

                const winner = winnerRows[0];
                const reservePrice = auction.reserve_price !== null ? Number(auction.reserve_price) : null;
                if (reservePrice !== null && Number(winner.amount) < reservePrice) {
                    processed.push({ auctionId: auction.id });
                    continue;
                }

                const { rows: existingWinnerRows } = await client.query(
                    'SELECT auction_id, order_id FROM auction_winners WHERE auction_id = $1',
                    [auction.id],
                );
                if (existingWinnerRows.length > 0) {
                    processed.push({
                        auctionId: auction.id,
                        winnerUserId: winner.user_id,
                        orderId: existingWinnerRows[0].order_id || undefined,
                    });
                    continue;
                }

                const orderId = await this.createWinnerOrder(client, auction, winner.user_id, Number(winner.amount));

                await client.query(
                    `INSERT INTO auction_winners (auction_id, winner_user_id, winning_bid_id, amount, order_id)
                     VALUES ($1, $2, $3, $4, $5)
                     ON CONFLICT (auction_id) DO NOTHING`,
                    [auction.id, winner.user_id, winner.id, winner.amount, orderId],
                );

                processed.push({ auctionId: auction.id, winnerUserId: winner.user_id, orderId });
            }

            await client.query('COMMIT');
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }

        for (const p of processed) {
            await this.auditService.log({
                action: p.winnerUserId ? 'auction.winner_assigned' : 'auction.end',
                entityType: 'auction',
                entityId: p.auctionId,
                meta: { winnerUserId: p.winnerUserId || null, orderId: p.orderId || null },
            });

            if (p.winnerUserId && p.orderId) {
                await this.notificationsService.notifyOrderCreated(
                    p.winnerUserId,
                    p.orderId,
                    0,
                    'SAR',
                    new Date(Date.now() + 15 * 60 * 1000).toISOString(),
                );
            }
        }

        return { processed: processed.length, winners: processed.filter((p) => !!p.winnerUserId).length };
    }

    private async createWinnerOrder(client: any, auction: any, winnerUserId: string, winningAmount: number) {
        const { rows: settingsRows } = await client.query(
            'SELECT commission_bps, minimum_fee FROM platform_settings WHERE id = 1',
        );

        const baseCommission = settingsRows.length > 0 ? Number(settingsRows[0].commission_bps) : 500;
        const minimumFee = settingsRows.length > 0 ? Number(settingsRows[0].minimum_fee) : 0;
        const commissionBps = await this.plansService.getCommissionBpsForUser(winnerUserId, baseCommission);

        const platformFee = Math.max(minimumFee, Math.round(winningAmount * commissionBps / 10000 * 100) / 100);
        const total = Math.round((winningAmount + platformFee) * 100) / 100;

        const reserveUntil = new Date(Date.now() + 15 * 60 * 1000);
        const year = new Date().getFullYear();
        const { rows: seqRows } = await client.query(
            `INSERT INTO invoice_sequences (year, last_no)
             VALUES ($1, 1)
             ON CONFLICT (year) DO UPDATE SET last_no = invoice_sequences.last_no + 1
             RETURNING last_no`,
            [year],
        );
        const invoiceNo = `INV-${year}-${String(seqRows[0].last_no).padStart(6, '0')}`;

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
             RETURNING id`,
            [winnerUserId, winningAmount, platformFee, total, invoiceNo],
        );

        const orderId = orderRows[0].id;

        await client.query(
            'INSERT INTO order_items (order_id, listing_id, price, currency) VALUES ($1, $2, $3, $4)',
            [orderId, auction.listing_id, winningAmount, 'SAR'],
        );

        await client.query(
            `UPDATE listings
             SET reserved_until = $2,
                 reserved_by_order_id = $3
             WHERE id = $1`,
            [auction.listing_id, reserveUntil.toISOString(), orderId],
        );

        await client.query(
            `INSERT INTO order_events (order_id, actor_user_id, actor_role, type, message, meta)
             VALUES ($1, NULL, 'SYSTEM', 'auction.winner_assigned', $2, $3)`,
            [orderId, 'تم تعيينك فائزًا بالمزاد وإنشاء الطلب', JSON.stringify({ auctionId: auction.id, winningAmount })],
        );

        return orderId;
    }
}
