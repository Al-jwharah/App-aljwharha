import { Module, Global, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

export const REDIS_CLIENT = 'REDIS_CLIENT';

const logger = new Logger('RedisModule');

@Global()
@Module({
    providers: [
        {
            provide: REDIS_CLIENT,
            inject: [ConfigService],
            useFactory: (config: ConfigService) => {
                const url = config.get<string>('REDIS_URL');

                if (!url) {
                    logger.warn('REDIS_URL not set — Redis disabled (in-memory fallback)');
                    return null;
                }

                const client = new Redis(url, {
                    maxRetriesPerRequest: 3,
                    lazyConnect: true,
                    retryStrategy: (times: number) => {
                        if (times > 5) return null; // stop retrying
                        return Math.min(times * 200, 2000);
                    },
                });

                client.on('connect', () => logger.log('Redis connected'));
                client.on('error', (err) => logger.error(`Redis error: ${err.message}`));
                client.on('close', () => logger.warn('Redis connection closed'));

                client.connect().catch((err) => {
                    logger.error(`Redis connect failed: ${err.message}`);
                });

                return client;
            },
        },
    ],
    exports: [REDIS_CLIENT],
})
export class RedisModule { }
