import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { DatabaseModule } from './database/database.module';
import { RedisModule } from './redis/redis.module';
import { AuditModule } from './audit/audit.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { ListingsModule } from './listings/listings.module';
import { PaymentsModule } from './payments/payments.module';
import { AdminModule } from './admin/admin.module';
import { CartModule } from './cart/cart.module';
import { OrdersModule } from './orders/orders.module';
import { JobsModule } from './jobs/jobs.module';
import { NotificationsModule } from './notifications/notifications.module';
import { SellerModule } from './seller/seller.module';
import { PlansModule } from './plans/plans.module';
import { AuctionsModule } from './auctions/auctions.module';
import { AdsModule } from './ads/ads.module';
import { SupportModule } from './support/support.module';
import { AiModule } from './ai/ai.module';
import { LegalModule } from './legal/legal.module';
import { OwnerModule } from './owner/owner.module';
import { SsoModule } from './sso/sso.module';
import { RequestIdMiddleware } from './middleware/request-id.middleware';
import { AccessLogMiddleware } from './middleware/access-log.middleware';
import { RedisThrottlerStorage } from './throttler/redis-throttler.storage';
import { UserThrottlerGuard } from './throttler/user-throttler.guard';

@Module({
    imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        ThrottlerModule.forRoot([{
            ttl: 60000,
            limit: 100,
        }]),
        DatabaseModule,
        RedisModule,
        AuditModule,
        HealthModule,
        AuthModule,
        ListingsModule,
        PaymentsModule,
        AdminModule,
        CartModule,
        OrdersModule,
        JobsModule,
        NotificationsModule,
        SellerModule,
        PlansModule,
        AuctionsModule,
        AdsModule,
        SupportModule,
        AiModule,
        LegalModule,
        OwnerModule,
        SsoModule,
    ],
    providers: [
        {
            provide: APP_GUARD,
            useClass: UserThrottlerGuard,
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
        consumer
            .apply(RequestIdMiddleware, AccessLogMiddleware)
            .forRoutes('*');
    }
}
