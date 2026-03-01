import { IsString, IsOptional, IsNumber, IsEnum, MaxLength, Min } from 'class-validator';

export class CreateListingDto {
    @IsString()
    @MaxLength(500)
    title: string;

    @IsOptional()
    @IsString()
    description?: string;

    @IsEnum(['TRADEMARK', 'FACTORY', 'STORE'], { message: 'نوع الإعلان غير صالح' })
    type: 'TRADEMARK' | 'FACTORY' | 'STORE';

    @IsOptional()
    @IsNumber()
    @Min(0)
    price?: number;

    @IsOptional()
    @IsString()
    @MaxLength(3)
    currency?: string;

    @IsOptional()
    @IsString()
    @MaxLength(100)
    city?: string;

    @IsOptional()
    @IsNumber()
    categoryId?: number;

    // Set by server from JWT — not provided by client
    @IsOptional()
    @IsString()
    ownerId?: string;
}
