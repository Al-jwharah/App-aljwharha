import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class TrackAdEventDto {
    @IsUUID()
    campaignId: string;

    @IsString()
    @IsNotEmpty()
    page: string;
}
