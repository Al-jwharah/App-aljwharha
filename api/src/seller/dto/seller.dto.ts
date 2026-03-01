import { IsNotEmpty, IsNumber, IsOptional, IsString, IsUrl, Min } from 'class-validator';

export class CreatePayoutRequestDto {
    @IsNumber()
    @Min(1)
    amount: number;
}

export class SellerFulfillOrderDto {
    @IsString()
    @IsNotEmpty()
    notes: string;

    @IsOptional()
    @IsUrl()
    proofUrl?: string;
}

export class SellerOrderNoteDto {
    @IsString()
    @IsNotEmpty()
    note: string;

    @IsOptional()
    @IsUrl()
    attachmentUrl?: string;
}
