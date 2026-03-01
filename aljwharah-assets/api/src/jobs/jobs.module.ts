import { Module } from '@nestjs/common';
import { SellerModule } from '../seller/seller.module';
import { AuctionsModule } from '../auctions/auctions.module';
import { AdsModule } from '../ads/ads.module';
import { JobsController } from './jobs.controller';
import { JobsService } from './jobs.service';

@Module({
    imports: [SellerModule, AuctionsModule, AdsModule],
    controllers: [JobsController],
    providers: [JobsService],
})
export class JobsModule { }
