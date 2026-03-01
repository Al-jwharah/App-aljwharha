import { Pool } from 'pg';
import { setTimeout as wait } from 'node:timers/promises';
import { MigrationRunner } from './migration-runner';

async function runWithRetry(connStr: string) {
    const maxAttempts = 20;
    let lastError: unknown = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        const pool = new Pool({ connectionString: connStr });
        const runner = new MigrationRunner(pool as any);

        try {
            await runner.run();
            await pool.end();
            return;
        } catch (err: any) {
            lastError = err;
            await pool.end().catch(() => undefined);

            const retryable = ['ENOENT', 'ECONNREFUSED', 'ETIMEDOUT', 'EHOSTUNREACH'].includes(err?.code || '');
            if (!retryable || attempt === maxAttempts) {
                throw err;
            }

            const delayMs = Math.min(5000, 1000 + attempt * 200);
            console.warn(`Migration attempt ${attempt}/${maxAttempts} failed (${err?.code || 'unknown'}). Retrying in ${delayMs}ms...`);
            await wait(delayMs);
        }
    }

    throw lastError || new Error('Migration failed after retries');
}

async function main() {
    const connStr = process.env.DATABASE_URL;
    if (!connStr) {
        throw new Error('DATABASE_URL is required for migrations');
    }

    await runWithRetry(connStr);
}

main()
    .then(() => {
        process.exit(0);
    })
    .catch((err) => {
        console.error('Migration failed:', err);
        process.exit(1);
    });