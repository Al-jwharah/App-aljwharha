import { Injectable, Inject, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { DATABASE_POOL } from '../database/database.module';
import { CartService } from '../cart/cart.service';

@Injectable()
export class OrdersService {
    private readonly logger = new Logger(OrdersService.name);

    constructor(
        @Inject(DATABASE_POOL) private readonly pool: any,
        private readonly cartService: CartService,
    ) { }

    async checkout(userId: string) {
        const cart = await this.cartService.getCart(userId);
        const availableItems = cart.items.filter((i: any) => i.available);

        if (availableItems.length === 0) {
            throw new BadRequestException('السلة فارغة أو لا توجد إعلانات متاحة');
        }

        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');

            // Recheck availability with row locks
            for (const item of availableItems) {
                const { rows } = await client.query(
                    'SELECT id, status, is_sold, reserved_until FROM listings WHERE id = $1 FOR UPDATE',
                    [item.listingId],
                );
                if (rows.length === 0 || rows[0].status !== 'APPROVED' || rows[0].is_sold) {
                    throw new BadRequestException(`الإعلان "${item.title}" لم يعد متاحاً`);
                }
                if (rows[0].reserved_until && new Date(rows[0].reserved_until) > new Date()) {
                    throw new BadRequestException(`الإعلان "${item.title}" محجوز حالياً`);
                }
            }

            const total = availableItems.reduce((s: number, i: any) => s + Number(i.price || 0), 0);

            // Create order
            const { rows: orderRows } = await client.query(
                `INSERT INTO orders (user_id, status, total, currency) VALUES ($1, 'RESERVED', $2, 'SAR') RETURNING *`,
                [userId, total],
            );
            const order = orderRows[0];

            // Create order items + reserve listings (15 min)
            const reserveUntil = new Date(Date.now() + 15 * 60 * 1000);
            for (const item of availableItems) {
                await client.query(
                    'INSERT INTO order_items (order_id, listing_id, price, currency) VALUES ($1, $2, $3, $4)',
                    [order.id, item.listingId, item.price, item.currency],
                );
                await client.query(
                    'UPDATE listings SET reserved_until = $1, reserved_by_order_id = $2 WHERE id = $3',
                    [reserveUntil, order.id, item.listingId],
                );
            }

            // Clear cart
            await client.query(
                'DELETE FROM cart_items WHERE cart_id = $1',
                [cart.cartId],
            );

            await client.query('COMMIT');
            this.logger.log(`Order ${order.id} created for user ${userId} — ${availableItems.length} items, total ${total} SAR`);

            return {
                ...order,
                items: availableItems.map((i: any) => ({
                    listingId: i.listingId,
                    title: i.title,
                    price: i.price,
                    currency: i.currency,
                })),
                reserveExpiresAt: reserveUntil.toISOString(),
            };
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    }

    async findAll(userId: string) {
        const { rows } = await this.pool.query(
            `SELECT o.*, json_agg(json_build_object(
                'listingId', oi.listing_id,
                'price', oi.price,
                'currency', oi.currency,
                'title', l.title,
                'type', l.type
            )) AS items
            FROM orders o
            LEFT JOIN order_items oi ON o.id = oi.order_id
            LEFT JOIN listings l ON oi.listing_id = l.id
            WHERE o.user_id = $1
            GROUP BY o.id
            ORDER BY o.created_at DESC`,
            [userId],
        );
        return { data: rows, total: rows.length };
    }

    async findOne(orderId: string, userId: string) {
        const { rows } = await this.pool.query(
            `SELECT o.*, json_agg(json_build_object(
                'listingId', oi.listing_id,
                'price', oi.price,
                'currency', oi.currency,
                'title', l.title,
                'type', l.type
            )) AS items
            FROM orders o
            LEFT JOIN order_items oi ON o.id = oi.order_id
            LEFT JOIN listings l ON oi.listing_id = l.id
            WHERE o.id = $1 AND o.user_id = $2
            GROUP BY o.id`,
            [orderId, userId],
        );

        if (rows.length === 0) throw new NotFoundException('الطلب غير موجود');
        return rows[0];
    }
}
