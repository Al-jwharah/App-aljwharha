import { Controller, Get, Patch, Query, Body, Param, Req, UseGuards } from '@nestjs/common';
import { AdsService } from './ads.service';
import { AuthGuard } from '../auth/guards/auth.guard';
import { RoleGuard, Roles } from '../auth/guards/role.guard';
import { UpdateAdProductDto } from './dto/update-ad-product.dto';

@Controller('admin/ads')
@UseGuards(AuthGuard, RoleGuard)
@Roles('ADMIN', 'SUPERADMIN')
export class AdminAdsController {
    constructor(private readonly adsService: AdsService) { }

    @Get('campaigns')
    listCampaigns(
        @Query('status') status?: string,
        @Query('q') q?: string,
        @Query('page') page?: string,
        @Query('pageSize') pageSize?: string,
    ) {
        return this.adsService.listCampaignsAdmin({
            status,
            q,
            page: page ? parseInt(page, 10) : 1,
            pageSize: pageSize ? parseInt(pageSize, 10) : 20,
        });
    }

    @Get('products')
    listProducts() {
        return this.adsService.listProducts();
    }

    @Patch('products/:code')
    updateProduct(@Param('code') code: string, @Body() dto: UpdateAdProductDto, @Req() req: any) {
        return this.adsService.updateProduct(code, dto, req.user.userId);
    }
}
