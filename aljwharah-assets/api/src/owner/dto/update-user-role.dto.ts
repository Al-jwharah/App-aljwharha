import { IsIn, IsNotEmpty, IsString } from 'class-validator';

export class UpdateUserRoleDto {
    @IsString()
    @IsIn(['USER', 'ADMIN', 'AGENT', 'SUPERADMIN'])
    role: string;

    @IsString()
    @IsNotEmpty()
    reason: string;
}
