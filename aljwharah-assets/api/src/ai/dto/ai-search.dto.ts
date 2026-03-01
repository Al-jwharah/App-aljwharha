import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class AiSearchDto {
    @IsString()
    @IsNotEmpty()
    query: string;

    @IsOptional()
    @IsString()
    locale?: string;
}
