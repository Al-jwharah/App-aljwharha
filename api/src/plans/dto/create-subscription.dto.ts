import { IsString, IsNotEmpty } from 'class-validator';

export class CreateSubscriptionDto {
    @IsString()
    @IsNotEmpty()
    planCode: string;
}
