import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import { CheckoutController } from './checkout.controller';
import { OrdersService } from './orders.service';
import { AuthModule } from '../auth/auth.module';
import { CartModule } from '../cart/cart.module';
import { PlansModule } from '../plans/plans.module';

@Module({
    imports: [AuthModule, CartModule, PlansModule],
    controllers: [OrdersController, CheckoutController],
    providers: [OrdersService],
    exports: [OrdersService],
})
export class OrdersModule { }
