import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateInfringementReportDto {
    @IsUUID()
    listingId: string;

    @IsString()
    @IsNotEmpty()
    reason: string;

    @IsOptional()
    @IsString()
    details?: string;
}
