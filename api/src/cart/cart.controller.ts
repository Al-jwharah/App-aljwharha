import { Controller, Get, Post, Delete, Body, Param, Req, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { AuthGuard } from '../auth/guards/auth.guard';
import { CartService } from './cart.service';
import { AddCartItemDto } from './dto/cart.dto';

@Controller('cart')
@UseGuards(AuthGuard)
export class CartController {
    constructor(private readonly cartService: CartService) { }

    @Get()
    getCart(@Req() req: any) {
        return this.cartService.getCart(req.user.userId);
    }

    @Post('items')
    addItem(@Req() req: any, @Body() dto: AddCartItemDto) {
        return this.cartService.addItem(req.user.userId, dto.listingId);
    }

    @Delete('items/:listingId')
    removeItem(@Req() req: any, @Param('listingId', ParseUUIDPipe) listingId: string) {
        return this.cartService.removeItem(req.user.userId, listingId);
    }
}
