import { Injectable, Inject, Optional } from '@nestjs/common';
import { ThrottlerStorage } from '@nestjs/throttler';
import { REDIS_CLIENT } from '../redis/redis.module';
import Redis from 'ioredis';

interface ThrottlerStorageRecord {
    totalHits: number;
    timeToExpire: number;
    isBlocked: boolean;
    timeToBlockExpire: number;
}

@Injectable()
export class RedisThrottlerStorage implements ThrottlerStorage {
    private inMemoryStore = new Map<string, { hits: number; expiresAt: number }>();

    constructor(@Inject(REDIS_CLIENT) @Optional() private readonly redis: Redis | null) { }

    async increment(key: string, ttl: number, limit: number, blockDuration: number, throttlerName: string): Promise<ThrottlerStorageRecord> {
        if (!this.redis) {
            return this.incrementInMemory(key, ttl, limit);
        }

        try {
            const redisKey = `throttle:${key}`;
            const current = await this.redis.incr(redisKey);
            if (current === 1) {
                await this.redis.pexpire(redisKey, ttl);
            }
            const pttl = await this.redis.pttl(redisKey);
            const timeToExpire = pttl > 0 ? pttl : ttl;

            return {
                totalHits: current,
                timeToExpire,
                isBlocked: current > limit,
                timeToBlockExpire: current > limit ? timeToExpire : 0,
            };
        } catch {
            // Fallback to in-memory if Redis fails
            return this.incrementInMemory(key, ttl, limit);
        }
    }

    private incrementInMemory(key: string, ttl: number, limit: number): ThrottlerStorageRecord {
        const now = Date.now();
        const existing = this.inMemoryStore.get(key);

        if (!existing || existing.expiresAt < now) {
            this.inMemoryStore.set(key, { hits: 1, expiresAt: now + ttl });
            return { totalHits: 1, timeToExpire: ttl, isBlocked: false, timeToBlockExpire: 0 };
        }

        existing.hits += 1;
        const timeToExpire = existing.expiresAt - now;

        return {
            totalHits: existing.hits,
            timeToExpire,
            isBlocked: existing.hits > limit,
            timeToBlockExpire: existing.hits > limit ? timeToExpire : 0,
        };
    }
}
