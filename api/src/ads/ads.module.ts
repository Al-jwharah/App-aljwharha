import { Module } from '@nestjs/common';
import { AdsService } from './ads.service';
import { AdsController } from './ads.controller';
import { AdminAdsController } from './admin-ads.controller';

@Module({
    providers: [AdsService],
    controllers: [AdsController, AdminAdsController],
    exports: [AdsService],
})
export class AdsModule { }
