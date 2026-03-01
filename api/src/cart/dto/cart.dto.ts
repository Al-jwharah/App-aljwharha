import { IsUUID } from 'class-validator';

export class AddCartItemDto {
    @IsUUID('4', { message: 'معرف الإعلان غير صالح' })
    listingId: string;
}
