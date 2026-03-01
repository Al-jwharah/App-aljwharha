import { Injectable, Inject, Logger } from '@nestjs/common';
import { DATABASE_POOL } from '../database/database.module';

export interface AuditEntry {
    actorUserId?: string | null;
    actorRole?: string | null;
    action: string;
    entityType: string;
    entityId: string;
    meta?: Record<string, any>;
}

@Injectable()
export class AuditService {
    private readonly logger = new Logger(AuditService.name);

    constructor(@Inject(DATABASE_POOL) private readonly pool: any) { }

    async log(entry: AuditEntry): Promise<void> {
        try {
            await this.pool.query(
                `INSERT INTO audit_log (actor_user_id, actor_role, action, entity_type, entity_id, meta)
                 VALUES ($1, $2, $3, $4, $5, $6)`,
                [
                    entry.actorUserId || null,
                    entry.actorRole || null,
                    entry.action,
                    entry.entityType,
                    entry.entityId,
                    JSON.stringify(entry.meta || {}),
                ],
            );
        } catch (err) {
            // Audit should never block business logic
            this.logger.error(`Audit log failed: ${(err as Error).message}`);
        }
    }
}
