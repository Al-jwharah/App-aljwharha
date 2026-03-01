import { IsInt, Min, Max, IsNumber, IsOptional } from 'class-validator';

export class UpdateSettingsDto {
    @IsInt()
    @Min(0)
    @Max(3000)
    commission_bps: number;

    @IsNumber()
    @Min(0)
    @IsOptional()
    minimum_fee?: number;
}
