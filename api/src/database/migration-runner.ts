import { Inject, Injectable, Logger } from '@nestjs/common';
import { DATABASE_POOL } from './database.module';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

@Injectable()
export class MigrationRunner {
    private readonly logger = new Logger(MigrationRunner.name);

    constructor(@Inject(DATABASE_POOL) private readonly pool: any) { }

    async run(): Promise<void> {
        // Create migrations tracking table
        await this.pool.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        applied_at TIMESTAMPTZ DEFAULT NOW()
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

        for (const file of files) {
            const { rows } = await this.pool.query(
                'SELECT 1 FROM _migrations WHERE name = $1',
                [file],
            );
            if (rows.length > 0) continue;

            this.logger.log(`Running migration: ${file}`);
            const sql = readFileSync(join(migrationsDir, file), 'utf-8');
            await this.pool.query(sql);
            await this.pool.query('INSERT INTO _migrations (name) VALUES ($1)', [
                file,
            ]);
            this.logger.log(`✅ Applied: ${file}`);
        }

        this.logger.log('All migrations applied.');
    }
}
