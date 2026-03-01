import { IsNotEmpty, IsString } from 'class-validator';

export class UpdateTicketStatusDto {
    @IsString()
    @IsNotEmpty()
    status: string;

    @IsString()
    @IsNotEmpty()
    reason: string;
}
