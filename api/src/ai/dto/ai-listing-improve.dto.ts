import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class AiListingImproveDto {
    @IsOptional()
    @IsUUID()
    listingId?: string;

    @IsOptional()
    @IsString()
    title?: string;

    @IsOptional()
    @IsString()
    description?: string;

    @IsOptional()
    @IsString()
    category?: string;

    @IsOptional()
    @IsString()
    city?: string;
}
