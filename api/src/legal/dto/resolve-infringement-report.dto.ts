import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class ResolveInfringementReportDto {
    @IsString()
    @IsNotEmpty()
    status: string;

    @IsString()
    @IsNotEmpty()
    reason: string;

    @IsOptional()
    @IsString()
    actionTaken?: string;
}
