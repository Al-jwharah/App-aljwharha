import { Controller, Get, Post, Param, Req, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { AuthGuard } from '../auth/guards/auth.guard';
import { OrdersService } from './orders.service';

@Controller('orders')
@UseGuards(AuthGuard)
export class OrdersController {
    constructor(private readonly ordersService: OrdersService) { }

    @Get()
    findAll(@Req() req: any) {
        return this.ordersService.findAll(req.user.userId);
    }

    @Get(':id')
    findOne(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
        return this.ordersService.findOne(id, req.user.userId);
    }

    @Get(':id/events')
    events(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
        return this.ordersService.getOrderEvents(id, req.user.userId, req.user.role);
    }

    @Post(':id/retry-payment')
    retryPayment(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
        return this.ordersService.retryPayment(id, req.user.userId);
    }
}
