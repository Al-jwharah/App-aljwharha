import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class AddTicketMessageDto {
    @IsString()
    @IsNotEmpty()
    message: string;

    @IsOptional()
    attachments?: unknown;
}
