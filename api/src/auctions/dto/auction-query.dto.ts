import { IsOptional, IsString } from 'class-validator';

export class AuctionQueryDto {
    @IsOptional()
    @IsString()
    status?: string;

    @IsOptional()
    @IsString()
    q?: string;

    @IsOptional()
    @IsString()
    sellerId?: string;

    @IsOptional()
    @IsString()
    page?: string;

    @IsOptional()
    @IsString()
    pageSize?: string;
}
