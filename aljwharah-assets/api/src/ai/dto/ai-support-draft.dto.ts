import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class AiSupportDraftDto {
    @IsUUID()
    ticketId: string;

    @IsString()
    @IsNotEmpty()
    userMessage: string;

    @IsOptional()
    @IsString()
    locale?: string;
}
