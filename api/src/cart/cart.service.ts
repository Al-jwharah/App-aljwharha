import { Injectable, Inject, BadRequestException, NotFoundException } from '@nestjs/common';
import { DATABASE_POOL } from '../database/database.module';

@Injectable()
export class CartService {
    constructor(@Inject(DATABASE_POOL) private readonly pool: any) { }

    async getOrCreateCart(userId: string): Promise<string> {
        // Upsert cart
        const { rows } = await this.pool.query(
            `INSERT INTO carts (user_id) VALUES ($1) ON CONFLICT (user_id) DO UPDATE SET updated_at = NOW() RETURNING id`,
            [userId],
        );
        return rows[0].id;
    }

    async getCart(userId: string) {
        const cartId = await this.getOrCreateCart(userId);

        const { rows } = await this.pool.query(
            `SELECT ci.id AS item_id, ci.listing_id, ci.created_at,
                    l.title, l.type, l.price, l.currency, l.city, l.status, l.is_sold,
                    l.reserved_until, l.reserved_by_order_id
             FROM cart_items ci
             JOIN listings l ON ci.listing_id = l.id
             WHERE ci.cart_id = $1
             ORDER BY ci.created_at DESC`,
            [cartId],
        );

        const items = rows.map((r: any) => ({
            itemId: r.item_id,
            listingId: r.listing_id,
            title: r.title,
            type: r.type,
            price: r.price,
            currency: r.currency || 'SAR',
            city: r.city,
            status: r.status,
            isSold: r.is_sold,
            available: r.status === 'APPROVED' && !r.is_sold && (!r.reserved_until || new Date(r.reserved_until) < new Date()),
            addedAt: r.created_at,
        }));

        const total = items.filter((i: any) => i.available).reduce((s: number, i: any) => s + Number(i.price || 0), 0);

        return { cartId, items, total, currency: 'SAR' };
    }

    async addItem(userId: string, listingId: string) {
        const cartId = await this.getOrCreateCart(userId);

        // Validate listing exists, is APPROVED, not sold
        const { rows: listings } = await this.pool.query(
            'SELECT id, status, is_sold, owner_id FROM listings WHERE id = $1',
            [listingId],
        );
        if (listings.length === 0) throw new NotFoundException('الإعلان غير موجود');
        if (listings[0].status !== 'APPROVED') throw new BadRequestException('الإعلان غير متاح');
        if (listings[0].is_sold) throw new BadRequestException('الإعلان تم بيعه');
        if (listings[0].owner_id === userId) throw new BadRequestException('لا يمكنك شراء إعلانك');

        await this.pool.query(
            'INSERT INTO cart_items (cart_id, listing_id) VALUES ($1, $2) ON CONFLICT (cart_id, listing_id) DO NOTHING',
            [cartId, listingId],
        );

        return this.getCart(userId);
    }

    async removeItem(userId: string, listingId: string) {
        const cartId = await this.getOrCreateCart(userId);
        await this.pool.query(
            'DELETE FROM cart_items WHERE cart_id = $1 AND listing_id = $2',
            [cartId, listingId],
        );
        return this.getCart(userId);
    }
}
