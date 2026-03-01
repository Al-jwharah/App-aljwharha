import { Module } from '@nestjs/common';
import { SupportService } from './support.service';
import { SupportController, AdminSupportController } from './support.controller';

@Module({
    providers: [SupportService],
    controllers: [SupportController, AdminSupportController],
    exports: [SupportService],
})
export class SupportModule { }
