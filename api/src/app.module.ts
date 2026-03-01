import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { DatabaseModule } from './database/database.module';
import { RedisModule } from './redis/redis.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { ListingsModule } from './listings/listings.module';
import { PaymentsModule } from './payments/payments.module';
import { AdminModule } from './admin/admin.module';
import { CartModule } from './cart/cart.module';
import { OrdersModule } from './orders/orders.module';
import { JobsModule } from './jobs/jobs.module';
import { RequestIdMiddleware } from './middleware/request-id.middleware';
import { RedisThrottlerStorage } from './throttler/redis-throttler.storage';

@Module({
    imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        // ── Rate Limiting: 100 req / 60s default, Redis-backed ──
        ThrottlerModule.forRoot([{
            ttl: 60000,
            limit: 100,
        }]),
        DatabaseModule,
        RedisModule,
        HealthModule,
        AuthModule,
        ListingsModule,
        PaymentsModule,
        AdminModule,
        CartModule,
        OrdersModule,
        JobsModule,
    ],
    providers: [
        {
            provide: APP_GUARD,
            useClass: ThrottlerGuard,
        },
        RedisThrottlerStorage,
        {
            provide: 'ThrottlerStorage',
            useExisting: RedisThrottlerStorage,
        },
    ],
})
export class AppModule implements NestModule {
    configure(consumer: MiddlewareConsumer) {
        consumer.apply(RequestIdMiddleware).forRoutes('*');
    }
}
