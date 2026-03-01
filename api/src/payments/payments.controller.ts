import {
    Controller,
    Post,
    Get,
    Body,
    Param,
    Req,
    UseGuards,
    HttpCode,
    RawBodyRequest,
    UnauthorizedException,
    Logger,
} from '@nestjs/common';
import { Throttle, SkipThrottle } from '@nestjs/throttler';
import { PaymentsService } from './payments.service';
import { AuthGuard } from '../auth/guards/auth.guard';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { Request } from 'express';
import { createHmac, timingSafeEqual } from 'crypto';
import { ConfigService } from '@nestjs/config';

@Controller()
export class PaymentsController {
    private readonly logger = new Logger(PaymentsController.name);

    constructor(
        private readonly paymentsService: PaymentsService,
        private readonly configService: ConfigService,
    ) { }

    /**
     * POST /payments/create
     * Create a payment charge linked to an order — requires auth
     */
    @Post('payments/create')
    @UseGuards(AuthGuard)
    @Throttle({ default: { limit: 30, ttl: 60000 } })
    async createPayment(@Body() dto: CreatePaymentDto, @Req() req: any) {
        return this.paymentsService.createPayment(dto.orderId, req.user.userId);
    }

    /**
     * GET /payments/charge/:id
     * Check charge status
     */
    @Get('payments/charge/:id')
    async getCharge(@Param('id') chargeId: string) {
        return this.paymentsService.getCharge(chargeId);
    }

    /**
     * POST /webhooks/tap
     * Handle Tap webhook callbacks — signature verified
     */
    @Post('webhooks/tap')
    @HttpCode(200)
    @Throttle({ default: { limit: 120, ttl: 60000 } })
    async handleWebhook(@Req() req: RawBodyRequest<Request>) {
        // ── Signature Verification ──
        const secret = this.configService.get<string>('TAP_WEBHOOK_SECRET')
            || this.configService.get<string>('TAP_SECRET_KEY')
            || '';

        const signatureHeader = req.headers['hashstring'] as string
            || req.headers['tap-signature'] as string
            || '';

        if (!secret) {
            this.logger.warn(`[${req['requestId'] || 'no-id'}] TAP_WEBHOOK_SECRET not configured — rejecting webhook`);
            throw new UnauthorizedException('Webhook secret not configured');
        }

        const rawBody = req.rawBody;
        if (!rawBody) {
            this.logger.warn(`[${req['requestId'] || 'no-id'}] Raw body not available for webhook verification`);
            throw new UnauthorizedException('Cannot verify webhook signature');
        }

        // Tap sends HMAC-SHA256 of the raw body using the webhook secret
        const expectedSignature = createHmac('sha256', secret)
            .update(rawBody)
            .digest('hex');

        if (!signatureHeader || !this.constantTimeCompare(signatureHeader, expectedSignature)) {
            this.logger.warn(`[${req['requestId'] || 'no-id'}] Invalid webhook signature`);
            throw new UnauthorizedException('Invalid webhook signature');
        }

        // Parse body (rawBody is Buffer, need JSON)
        const payload = JSON.parse(rawBody.toString('utf-8'));
        return this.paymentsService.handleWebhook(payload);
    }

    private constantTimeCompare(a: string, b: string): boolean {
        try {
            const bufA = Buffer.from(a, 'utf-8');
            const bufB = Buffer.from(b, 'utf-8');
            if (bufA.length !== bufB.length) return false;
            return timingSafeEqual(bufA, bufB);
        } catch {
            return false;
        }
    }
}
