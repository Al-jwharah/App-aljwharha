import { Controller, Get, Post, Body, Query, Req, UseGuards, Param, ParseUUIDPipe } from '@nestjs/common';
import { AuthGuard } from '../auth/guards/auth.guard';
import { SellerService } from './seller.service';
import { CreatePayoutRequestDto, SellerFulfillOrderDto, SellerOrderNoteDto } from './dto/seller.dto';

@Controller('seller')
@UseGuards(AuthGuard)
export class SellerController {
    constructor(private readonly sellerService: SellerService) { }

    @Get('balance')
    getBalance(@Req() req: any) {
        return this.sellerService.getSellerBalance(req.user.userId);
    }

    @Get('ledger')
    getLedger(
        @Req() req: any,
        @Query('page') page?: string,
        @Query('pageSize') pageSize?: string,
    ) {
        return this.sellerService.getSellerLedger(
            req.user.userId,
            this.parsePositiveInt(page, 1),
            this.parsePositiveInt(pageSize, 20),
        );
    }

    @Post('payout-request')
    createPayoutRequest(@Req() req: any, @Body() dto: CreatePayoutRequestDto) {
        return this.sellerService.createPayoutRequest(req.user.userId, dto.amount);
    }

    @Post('orders/:id/fulfill')
    fulfillOrder(
        @Req() req: any,
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: SellerFulfillOrderDto,
    ) {
        return this.sellerService.fulfillOrder(id, req.user.userId, dto.notes, dto.proofUrl);
    }

    @Post('orders/:id/add-note')
    addOrderNote(
        @Req() req: any,
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: SellerOrderNoteDto,
    ) {
        return this.sellerService.addOrderNote(id, req.user.userId, dto.note, dto.attachmentUrl);
    }

    private parsePositiveInt(value: string | undefined, fallback: number) {
        if (!value) return fallback;
        const parsed = parseInt(value, 10);
        if (Number.isNaN(parsed) || parsed < 1) return fallback;
        return parsed;
    }
}
