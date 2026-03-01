import { Controller, Get, Inject, Optional } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { DATABASE_POOL } from '../database/database.module';
import { REDIS_CLIENT } from '../redis/redis.module';
import Redis from 'ioredis';

@Controller('health')
@SkipThrottle()
export class HealthController {
    constructor(
        @Inject(DATABASE_POOL) private readonly pool: any,
        @Inject(REDIS_CLIENT) @Optional() private readonly redis: Redis | null,
    ) { }

    @Get()
    check() {
        return {
            status: 'ok',
            timestamp: new Date().toISOString(),
            service: 'aljwharah-api',
        };
    }

    @Get('ready')
    async readiness() {
        let dbOk = false;
        let redisOk = this.redis ? false : true;

        try {
            await this.pool.query('SELECT 1');
            dbOk = true;
        } catch {
            dbOk = false;
        }

        if (this.redis) {
            try {
                const pong = await this.redis.ping();
                redisOk = pong === 'PONG';
            } catch {
                redisOk = false;
            }
        }

        const ok = dbOk && redisOk;
        return {
            status: ok ? 'ready' : 'not_ready',
            checks: {
                db: dbOk ? 'ok' : 'error',
                redis: this.redis ? (redisOk ? 'ok' : 'error') : 'disabled',
            },
            timestamp: new Date().toISOString(),
        };
    }

    @Get('db')
    async checkDb() {
        try {
            const { rows } = await this.pool.query('SELECT NOW() AS now');
            return {
                status: 'ok',
                db: 'connected',
                serverTime: rows[0].now,
            };
        } catch (error: any) {
            return {
                status: 'error',
                db: 'disconnected',
                error: error.message,
            };
        }
    }

    @Get('redis')
    async checkRedis() {
        if (!this.redis) {
            return { status: 'disabled', redis: 'not configured' };
        }
        try {
            const pong = await this.redis.ping();
            return { status: 'ok', redis: 'connected', ping: pong };
        } catch (error: any) {
            return { status: 'error', redis: 'disconnected', error: error.message };
        }
    }
}