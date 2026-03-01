import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AdminOrdersService } from './admin-orders.service';
import { SettingsService } from './settings.service';
import { RevenueService } from './revenue.service';
import { AuthModule } from '../auth/auth.module';
import { SellerModule } from '../seller/seller.module';

@Module({
    imports: [AuthModule, SellerModule],
    controllers: [AdminController],
    providers: [AdminService, AdminOrdersService, SettingsService, RevenueService],
})
export class AdminModule { }
