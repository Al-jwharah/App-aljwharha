import { Inject, Injectable, Logger } from '@nestjs/common';
import { DATABASE_POOL } from './database.tokens';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

@Injectable()
export class MigrationRunner {
    private readonly logger = new Logger(MigrationRunner.name);

    constructor(@Inject(DATABASE_POOL) private readonly pool: any) { }

    async run(): Promise<void> {
        // Create migrations tracking table (schema_migrations is canonical)
        await this.pool.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) NOT NULL UNIQUE,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

        const migrationsDir = join(__dirname, '..', '..', 'migrations');
        let files: string[];
        try {
            files = readdirSync(migrationsDir)
                .filter((f: string) => f.endsWith('.sql'))
                .sort();
        } catch {
            this.logger.warn('No migrations directory found, skipping.');
            return;
        }

        const duplicateSchemaCodes = new Set(['42710', '42P07', '42701', '23505']);

        for (const file of files) {
            const { rows } = await this.pool.query(
                'SELECT 1 FROM schema_migrations WHERE filename = $1',
                [file],
            );
            if (rows.length > 0) continue;

            this.logger.log(`Running migration: ${file}`);
            const sql = readFileSync(join(migrationsDir, file), 'utf-8');

            try {
                await this.pool.query(sql);
            } catch (err: any) {
                if (duplicateSchemaCodes.has(err?.code || '')) {
                    this.logger.warn(`Skipping duplicate schema object while applying ${file}: ${err.message}`);
                } else {
                    throw err;
                }
            }

            await this.pool.query(
                'INSERT INTO schema_migrations (filename) VALUES ($1) ON CONFLICT (filename) DO NOTHING',
                [file],
            );
            this.logger.log(`✅ Applied: ${file}`);
        }

        this.logger.log('All migrations applied.');
    }
}