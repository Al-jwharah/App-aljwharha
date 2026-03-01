import { IsDateString, IsNumber, IsOptional, IsUUID, Min } from 'class-validator';

export class CreateAuctionDto {
    @IsUUID()
    listingId: string;

    @IsDateString()
    startsAt: string;

    @IsDateString()
    endsAt: string;

    @IsNumber()
    @Min(0)
    startingPrice: number;

    @IsNumber()
    @Min(0.01)
    bidIncrement: number;

    @IsOptional()
    @IsNumber()
    @Min(0)
    reservePrice?: number;

    @IsOptional()
    @IsNumber()
    @Min(0)
    buyNowPrice?: number;

    @IsOptional()
    @IsNumber()
    @Min(0)
    antiSnipingSeconds?: number;
}
