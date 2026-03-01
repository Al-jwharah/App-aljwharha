import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { AuthModule } from '../auth/auth.module';
import { SellerModule } from '../seller/seller.module';
import { AdsModule } from '../ads/ads.module';
import { PlansModule } from '../plans/plans.module';

@Module({
    imports: [AuthModule, SellerModule, AdsModule, PlansModule],
    controllers: [PaymentsController],
    providers: [PaymentsService],
})
export class PaymentsModule { }
