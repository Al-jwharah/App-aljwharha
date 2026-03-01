import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { DATABASE_POOL } from '../database/database.module';

@Injectable()
export class AdminService {
    constructor(@Inject(DATABASE_POOL) private readonly pool: any) { }

    async getPendingListings() {
        const { rows } = await this.pool.query(
            `SELECT l.*, c.name_ar AS category_name_ar, u.email AS owner_email, u.name AS owner_name
             FROM listings l
             LEFT JOIN categories c ON l.category_id = c.id
             LEFT JOIN users u ON l.owner_id = u.id
             WHERE l.status = 'DRAFT'
             ORDER BY l.created_at DESC`,
        );
        return { data: rows, total: rows.length };
    }

    async approveListing(id: string) {
        const { rows } = await this.pool.query(
            `UPDATE listings SET status = 'APPROVED' WHERE id = $1 RETURNING *`,
            [id],
        );
        if (rows.length === 0) throw new NotFoundException('الإعلان غير موجود');
        return rows[0];
    }

    async rejectListing(id: string) {
        const { rows } = await this.pool.query(
            `UPDATE listings SET status = 'REJECTED' WHERE id = $1 RETURNING *`,
            [id],
        );
        if (rows.length === 0) throw new NotFoundException('الإعلان غير موجود');
        return rows[0];
    }
}
