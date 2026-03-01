import { Module } from '@nestjs/common';
import { AuctionsController } from './auctions.controller';
import { AuctionsService } from './auctions.service';
import { PlansModule } from '../plans/plans.module';

@Module({
    imports: [PlansModule],
    controllers: [AuctionsController],
    providers: [AuctionsService],
    exports: [AuctionsService],
})
export class AuctionsModule { }
