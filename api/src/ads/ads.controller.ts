import { Controller, Get, Post, Body, Req, UseGuards, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { AdsService } from './ads.service';
import { AuthGuard } from '../auth/guards/auth.guard';
import { CreateAdCampaignDto } from './dto/create-ad-campaign.dto';
import { TrackAdEventDto } from './dto/track-ad-event.dto';

@Controller('ads')
export class AdsController {
    constructor(private readonly adsService: AdsService) { }

    @Get('products')
    getProducts() {
        return this.adsService.listProducts();
    }

    @Get('placements')
    getPlacements(@Query('page') page?: string, @Query('limit') limit?: string) {
        return this.adsService.getPlacements(page || 'home', limit ? parseInt(limit, 10) : 12);
    }

    @Post('campaigns')
    @UseGuards(AuthGuard)
    createCampaign(@Req() req: any, @Body() dto: CreateAdCampaignDto) {
        return this.adsService.createCampaign(req.user.userId, dto.listingId, dto.productCode);
    }

    @Get('campaigns/mine')
    @UseGuards(AuthGuard)
    getMine(@Req() req: any, @Query('page') page?: string, @Query('pageSize') pageSize?: string) {
        return this.adsService.listCampaignsForSeller(
            req.user.userId,
            page ? parseInt(page, 10) : 1,
            pageSize ? parseInt(pageSize, 10) : 20,
        );
    }

    @Post('campaigns/:id/pay')
    @UseGuards(AuthGuard)
    payCampaign(@Req() req: any, @Param('id', ParseUUIDPipe) id: string) {
        return this.adsService.payCampaign(id, req.user.userId);
    }

    @Post('track/impression')
    trackImpression(@Body() dto: TrackAdEventDto) {
        return this.adsService.trackImpression(dto.campaignId, dto.page);
    }

    @Post('track/click')
    trackClick(@Body() dto: TrackAdEventDto) {
        return this.adsService.trackClick(dto.campaignId, dto.page);
    }
}
