import { Module, Global, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';

export const DATABASE_POOL = 'DATABASE_POOL';

const logger = new Logger('DatabaseModule');

@Global()
@Module({
    providers: [
        {
            provide: DATABASE_POOL,
            inject: [ConfigService],
            useFactory: (config: ConfigService) => {
                const connStr = config.get<string>('DATABASE_URL');
                logger.log(`DATABASE_URL set: ${!!connStr}`);

                if (!connStr) {
                    logger.warn('DATABASE_URL not set — using dummy pool');
                    return { query: async () => { throw new Error('No DB configured'); } };
                }

                const pool = new Pool({
                    connectionString: connStr,
                    max: 5,
                    idleTimeoutMillis: 30_000,
                    connectionTimeoutMillis: 5_000,
                });

                pool.on('error', (err) => {
                    logger.error('Pool error: ' + err.message);
                });

                logger.log('PostgreSQL pool created');
                return pool;
            },
        },
    ],
    exports: [DATABASE_POOL],
})
export class DatabaseModule { }
