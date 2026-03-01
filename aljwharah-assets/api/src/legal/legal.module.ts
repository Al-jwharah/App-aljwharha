import { Module } from '@nestjs/common';
import { LegalService } from './legal.service';
import { LegalController, AdminLegalController } from './legal.controller';

@Module({
    providers: [LegalService],
    controllers: [LegalController, AdminLegalController],
    exports: [LegalService],
})
export class LegalModule { }
