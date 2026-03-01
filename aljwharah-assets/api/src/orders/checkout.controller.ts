import { Controller, Post, Req, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthGuard } from '../auth/guards/auth.guard';
import { OrdersService } from '../orders/orders.service';

@Controller('checkout')
@UseGuards(AuthGuard)
export class CheckoutController {
    constructor(private readonly ordersService: OrdersService) { }

    @Post()
    @HttpCode(HttpStatus.CREATED)
    @Throttle({ default: { limit: 30, ttl: 60000 } })
    checkout(@Req() req: any) {
        return this.ordersService.checkout(req.user.userId);
    }
}
