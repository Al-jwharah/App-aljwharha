import { Controller, Get, Post, Param, Req, UseGuards, ParseUUIDPipe, HttpCode, HttpStatus } from '@nestjs/common';
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
}
