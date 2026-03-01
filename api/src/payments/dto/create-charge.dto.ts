export class CreateChargeDto {
    amount: number;
    currency?: string;        // default SAR
    description?: string;
    listingId?: string;       // reference to listing being purchased
    customerName: string;
    customerEmail: string;
    customerPhone?: string;
    redirectUrl: string;      // where to send user after payment
}
