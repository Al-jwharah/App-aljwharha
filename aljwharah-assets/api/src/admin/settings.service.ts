import { Injectable, Inject, Logger, BadRequestException } from '@nestjs/common';
import { DATABASE_POOL } from '../database/database.module';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class SettingsService {
    private readonly logger = new Logger(SettingsService.name);

    constructor(
        @Inject(DATABASE_POOL) private readonly pool: any,
        private readonly auditService: AuditService,
    ) { }

    async getSettings() {
        const { rows } = await this.pool.query('SELECT * FROM platform_settings WHERE id = 1');
        if (rows.length === 0) {
            return { commission_bps: 500, minimum_fee: 0 };
        }
        return rows[0];
    }

    async updateSettings(commissionBps: number, minimumFee: number, adminUserId: string) {
        if (!Number.isFinite(commissionBps) || commissionBps < 0 || commissionBps > 10000) {
            throw new BadRequestException('commission_bps must be between 0 and 10000');
        }
        if (!Number.isFinite(minimumFee) || minimumFee < 0) {
            throw new BadRequestException('minimum_fee must be >= 0');
        }
        const { rows } = await this.pool.query(
            `UPDATE platform_settings SET commission_bps = $1, minimum_fee = $2 WHERE id = 1 RETURNING *`,
            [commissionBps, minimumFee],
        );

        await this.auditService.log({
            actorUserId: adminUserId, actorRole: 'ADMIN',
            action: 'settings.update', entityType: 'settings', entityId: '1',
            meta: { commissionBps, minimumFee },
        });

        this.logger.log(`Settings updated: commission_bps=${commissionBps}, minimum_fee=${minimumFee}`);
        return rows[0];
    }
}
