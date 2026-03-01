import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class UpdateAdProductDto {
    @IsOptional()
    @IsNumber()
    @Min(0)
    price_amount?: number;

    @IsOptional()
    @IsString()
    currency?: string;

    @IsOptional()
    @IsNumber()
    @Min(1)
    duration_days?: number;
}
