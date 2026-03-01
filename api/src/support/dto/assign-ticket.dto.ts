import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class AssignTicketDto {
    @IsUUID()
    agentUserId: string;

    @IsString()
    @IsNotEmpty()
    reason: string;
}
