import { IsOptional, IsString, MaxLength } from 'class-validator';

export class AdminReasonDto {
    @IsString()
    @MaxLength(500)
    reason: string;
}

export class AdminRefundDto {
    @IsString()
    @MaxLength(500)
    reason: string;

    @IsOptional()
    amount?: number;

    @IsOptional()
    @IsString()
    currency?: string;
}

export class AdminNoteDto {
    @IsString()
    @MaxLength(2000)
    note: string;
}

