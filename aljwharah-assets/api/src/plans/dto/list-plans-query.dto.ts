import { IsOptional, IsNumber, Min } from 'class-validator';

export class ListPlansQueryDto {
    @IsOptional()
    @IsNumber()
    @Min(1)
    page?: number;

    @IsOptional()
    @IsNumber()
    @Min(1)
    pageSize?: number;
}
