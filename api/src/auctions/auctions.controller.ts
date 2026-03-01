import {
    Controller,
    Get,
    Post,
    Patch,
    Param,
    Body,
    Query,
    Req,
    ParseUUIDPipe,
    UseGuards,
} from '@nestjs/common';
import { AuctionsService } from './auctions.service';
import { AuthGuard } from '../auth/guards/auth.guard';
import { CreateAuctionDto } from './dto/create-auction.dto';
import { PlaceBidDto } from './dto/place-bid.dto';

@Controller('auctions')
export class AuctionsController {
    constructor(private readonly auctionsService: AuctionsService) { }

    @Get()
    list(
        @Query('status') status?: string,
        @Query('q') q?: string,
        @Query('sellerId') sellerId?: string,
        @Query('page') page?: string,
        @Query('pageSize') pageSize?: string,
    ) {
        return this.auctionsService.listAuctions({
            status,
            q,
            sellerId,
            page: page ? parseInt(page, 10) : 1,
            pageSize: pageSize ? parseInt(pageSize, 10) : 20,
        });
    }

    @Get('my-bids')
    @UseGuards(AuthGuard)
    myBids(
        @Req() req: any,
        @Query('page') page?: string,
        @Query('pageSize') pageSize?: string,
    ) {
        return this.auctionsService.listUserBids(
            req.user.userId,
            page ? parseInt(page, 10) : 1,
            pageSize ? parseInt(pageSize, 10) : 20,
        );
    }

    @Get(':id')
    getOne(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
        const userId = req?.user?.userId;
        return this.auctionsService.getAuction(id, userId);
    }

    @Post()
    @UseGuards(AuthGuard)
    createDraft(@Req() req: any, @Body() dto: CreateAuctionDto) {
        return this.auctionsService.createDraft(req.user.userId, dto);
    }

    @Patch(':id/publish')
    @UseGuards(AuthGuard)
    publish(@Req() req: any, @Param('id', ParseUUIDPipe) id: string) {
        return this.auctionsService.publishAuction(id, req.user.userId);
    }

    @Patch(':id/cancel')
    @UseGuards(AuthGuard)
    cancel(@Req() req: any, @Param('id', ParseUUIDPipe) id: string) {
        return this.auctionsService.cancelAuction(id, req.user.userId);
    }

    @Post(':id/bid')
    @UseGuards(AuthGuard)
    bid(@Req() req: any, @Param('id', ParseUUIDPipe) id: string, @Body() dto: PlaceBidDto) {
        return this.auctionsService.placeBid(id, req.user.userId, dto.amount);
    }
}
