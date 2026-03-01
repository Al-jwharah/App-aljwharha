import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class CreateAdCampaignDto {
    @IsUUID()
    listingId: string;

    @IsString()
    @IsNotEmpty()
    productCode: string;
}
