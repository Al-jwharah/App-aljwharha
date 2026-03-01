import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { DATABASE_POOL } from '../database/database.module';
import { CreateListingDto } from './dto/create-listing.dto';
import { PlansService } from '../plans/plans.service';

@Injectable()
export class ListingsService {
    constructor(
        @Inject(DATABASE_POOL) private readonly pool: any,
        private readonly plansService: PlansService,
    ) { }

    async create(dto: CreateListingDto) {
        if (dto.ownerId) {
            await this.plansService.assertListingAllowed(dto.ownerId);
        }

        const { rows } = await this.pool.query(
            `INSERT INTO listings (title, description, type, price, currency, city, category_id, owner_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
            [
                dto.title,
                dto.description ?? null,
                dto.type,
                dto.price ?? null,
                dto.currency ?? 'SAR',
                dto.city ?? null,
                dto.categoryId ?? null,
                dto.ownerId ?? null,
            ],
        );
        return rows[0];
    }

    async findAll(filters: {
        type?: string;
        status?: string;
        q?: string;
        categoryId?: number;
        page?: number;
        limit?: number;
    }) {
        const conditions: string[] = [];
        const params: any[] = [];
        let paramIdx = 1;

        const status = filters.status || 'APPROVED';
        conditions.push(`l.status = $${paramIdx++}`);
        params.push(status);

        if (filters.type) {
            conditions.push(`l.type = $${paramIdx++}`);
            params.push(filters.type);
        }
        if (filters.categoryId) {
            conditions.push(`l.category_id = $${paramIdx++}`);
            params.push(filters.categoryId);
        }
        if (filters.q?.trim()) {
            conditions.push(`(
                l.title ILIKE $${paramIdx}
                OR COALESCE(l.description, '') ILIKE $${paramIdx}
                OR COALESCE(l.city, '') ILIKE $${paramIdx}
            )`);
            params.push(`%${filters.q.trim()}%`);
            paramIdx++;
        }

        conditions.push(`(l.is_sold = false OR l.is_sold IS NULL)`);

        const page = filters.page ?? 1;
        const limit = Math.min(filters.limit ?? 20, 100);
        const offset = (page - 1) * limit;

        const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

        const countQuery = `SELECT COUNT(*) FROM listings l ${where}`;
        const dataQuery = `
      SELECT l.*, c.name_ar AS category_name_ar, c.name_en AS category_name_en, c.slug AS category_slug
      FROM listings l
      LEFT JOIN categories c ON l.category_id = c.id
      ${where}
      ORDER BY l.created_at DESC
      LIMIT $${paramIdx++} OFFSET $${paramIdx++}
    `;

        const [countResult, dataResult] = await Promise.all([
            this.pool.query(countQuery, params),
            this.pool.query(dataQuery, [...params, limit, offset]),
        ]);

        return {
            data: dataResult.rows,
            total: parseInt(countResult.rows[0].count, 10),
            page,
            limit,
        };
    }

    async findByOwner(ownerId: string) {
        const { rows } = await this.pool.query(
            `SELECT l.*, c.name_ar AS category_name_ar
             FROM listings l
             LEFT JOIN categories c ON l.category_id = c.id
             WHERE l.owner_id = $1
             ORDER BY l.created_at DESC`,
            [ownerId],
        );
        return { data: rows, total: rows.length };
    }

    async findOne(id: string) {
        const { rows: listings } = await this.pool.query(
            'SELECT l.*, c.name_ar AS category_name_ar, c.name_en AS category_name_en FROM listings l LEFT JOIN categories c ON l.category_id = c.id WHERE l.id = $1',
            [id],
        );

        if (listings.length === 0) {
            throw new NotFoundException(`Listing ${id} not found`);
        }

        const { rows: attachments } = await this.pool.query(
            'SELECT * FROM attachments WHERE listing_id = $1 ORDER BY sort_order',
            [id],
        );

        return { ...listings[0], attachments };
    }

    async update(id: string, dto: Partial<CreateListingDto>) {
        const fields: string[] = [];
        const values: any[] = [];
        let idx = 1;

        if (dto.title !== undefined) { fields.push(`title = $${idx++}`); values.push(dto.title); }
        if (dto.description !== undefined) { fields.push(`description = $${idx++}`); values.push(dto.description); }
        if (dto.price !== undefined) { fields.push(`price = $${idx++}`); values.push(dto.price); }
        if (dto.currency !== undefined) { fields.push(`currency = $${idx++}`); values.push(dto.currency); }
        if (dto.city !== undefined) { fields.push(`city = $${idx++}`); values.push(dto.city); }

        if (fields.length === 0) {
            return this.findOne(id);
        }

        values.push(id);
        const { rows } = await this.pool.query(
            `UPDATE listings SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
            values,
        );

        if (rows.length === 0) throw new NotFoundException('الإعلان غير موجود');
        return rows[0];
    }

    async remove(id: string) {
        const { rowCount } = await this.pool.query('DELETE FROM listings WHERE id = $1', [id]);
        if (rowCount === 0) throw new NotFoundException('الإعلان غير موجود');
    }
}
