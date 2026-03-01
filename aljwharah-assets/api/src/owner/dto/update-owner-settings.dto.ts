import { IsBoolean, IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class UpdateOwnerSettingsDto {
    @IsOptional()
    @IsInt()
    @Min(0)
    commission_bps?: number;

    @IsOptional()
    @IsNumber()
    @Min(0)
    minimum_fee?: number;

    @IsOptional()
    @IsInt()
    @Min(1)
    settlement_delay_days?: number;

    @IsOptional()
    @IsBoolean()
    auction_pick_next_highest?: boolean;

    @IsOptional()
    @IsBoolean()
    enforce_domain_allowlist?: boolean;

    @IsString()
    reason: string;
}
