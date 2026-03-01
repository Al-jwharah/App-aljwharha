import { IsUUID } from 'class-validator';

export class CreatePaymentDto {
    @IsUUID('4', { message: 'معرف الطلب غير صالح' })
    orderId: string;
}
