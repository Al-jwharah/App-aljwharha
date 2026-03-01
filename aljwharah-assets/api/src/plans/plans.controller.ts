import { Controller, Get, Post, Param, Req, Body, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { AuthGuard } from '../auth/guards/auth.guard';
import { PlansService } from './plans.service';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';

@Controller()
export class PlansController {
    constructor(private readonly plansService: PlansService) { }

    @Get('plans')
    getPlans() {
        return this.plansService.getPlans();
    }

    @Get('subscriptions/me')
    @UseGuards(AuthGuard)
    getMySubscription(@Req() req: any) {
        return this.plansService.getMySubscription(req.user.userId);
    }

    @Post('subscriptions')
    @UseGuards(AuthGuard)
    createSubscription(@Req() req: any, @Body() dto: CreateSubscriptionDto) {
        return this.plansService.createSubscription(req.user.userId, dto.planCode);
    }

    @Post('subscriptions/:id/pay')
    @UseGuards(AuthGuard)
    paySubscription(@Req() req: any, @Param('id', ParseUUIDPipe) id: string) {
        return this.plansService.createSubscriptionPayment(id, req.user.userId);
    }
}
