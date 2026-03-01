import { Injectable, Inject } from '@nestjs/common';
import { DATABASE_POOL } from '../database/database.module';

@Injectable()
export class RevenueService {
    constructor(@Inject(DATABASE_POOL) private readonly pool: any) { }

    async getSummary(from: string, to: string) {
        const { rows } = await this.pool.query(
            `SELECT
                COUNT(*)::int AS orders_count,
                COALESCE(SUM(subtotal_amount), 0)::numeric AS gross_subtotal_sum,
                COALESCE(SUM(platform_fee_amount), 0)::numeric AS gross_platform_fee_sum,
                COALESCE(SUM(COALESCE(total_amount, total)), 0)::numeric AS gross_total_sum,

                COUNT(*) FILTER (WHERE status = 'PAID')::int AS paid_orders_count,
                COALESCE(SUM(subtotal_amount) FILTER (WHERE status = 'PAID'), 0)::numeric AS paid_subtotal_sum,
                COALESCE(SUM(platform_fee_amount) FILTER (WHERE status = 'PAID'), 0)::numeric AS paid_platform_fee_sum,
                COALESCE(SUM(COALESCE(total_amount, total)) FILTER (WHERE status = 'PAID'), 0)::numeric AS paid_total_sum,

                COUNT(*) FILTER (WHERE status = 'REFUNDED')::int AS refunded_orders_count,
                COALESCE(SUM(platform_fee_amount) FILTER (WHERE status = 'REFUNDED'), 0)::numeric AS refunded_platform_fee_sum,

                (COALESCE(SUM(platform_fee_amount) FILTER (WHERE status = 'PAID'), 0)
                 - COALESCE(SUM(platform_fee_amount) FILTER (WHERE status = 'REFUNDED'), 0))::numeric AS net_platform_fee_sum
            FROM orders
            WHERE created_at >= $1 AND created_at < $2`,
            [from, to],
        );
        return rows[0];
    }
}