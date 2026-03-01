import { Controller, Post, Req, HttpCode, HttpStatus, UnauthorizedException, Logger } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';
import { JobsService } from './jobs.service';
import { Request } from 'express';

@Controller('internal/jobs')
@SkipThrottle()
export class JobsController {
    private readonly logger = new Logger(JobsController.name);

    constructor(
        private readonly jobsService: JobsService,
        private readonly configService: ConfigService,
    ) { }

    @Post('release-expired')
    @HttpCode(HttpStatus.OK)
    async releaseExpired(@Req() req: Request) {
        this.verifySecret(req);
        const result = await this.jobsService.releaseExpiredReservations();
        this.logger.log(`[${req['requestId'] || 'no-id'}] release-expired: ${JSON.stringify(result)}`);
        return result;
    }

    @Post('reconcile-payments')
    @HttpCode(HttpStatus.OK)
    async reconcilePayments(@Req() req: Request) {
        this.verifySecret(req);
        const result = await this.jobsService.reconcilePendingPayments();
        this.logger.log(`[${req['requestId'] || 'no-id'}] reconcile-payments: ${JSON.stringify(result)}`);
        return result;
    }

    @Post('settle-balances')
    @HttpCode(HttpStatus.OK)
    async settleBalances(@Req() req: Request) {
        this.verifySecret(req);
        const result = await this.jobsService.settleSellerBalances();
        this.logger.log(`[${req['requestId'] || 'no-id'}] settle-balances: ${JSON.stringify(result)}`);
        return result;
    }

    @Post('process-notifications')
    @HttpCode(HttpStatus.OK)
    async processNotifications(@Req() req: Request) {
        this.verifySecret(req);
        const result = await this.jobsService.processNotifications();
        this.logger.log(`[${req['requestId'] || 'no-id'}] process-notifications: ${JSON.stringify(result)}`);
        return result;
    }

    @Post('close-auctions')
    @HttpCode(HttpStatus.OK)
    async closeAuctions(@Req() req: Request) {
        this.verifySecret(req);
        const result = await this.jobsService.closeEndedAuctions();
        this.logger.log(`[${req['requestId'] || 'no-id'}] close-auctions: ${JSON.stringify(result)}`);
        return result;
    }

    @Post('expire-ads')
    @HttpCode(HttpStatus.OK)
    async expireAds(@Req() req: Request) {
        this.verifySecret(req);
        const result = await this.jobsService.expireAdCampaigns();
        this.logger.log(`[${req['requestId'] || 'no-id'}] expire-ads: ${JSON.stringify(result)}`);
        return result;
    }

    private verifySecret(req: Request) {
        const expected = this.configService.get<string>('INTERNAL_JOB_SECRET');
        if (!expected) {
            this.logger.warn(`[${req['requestId'] || 'no-id'}] INTERNAL_JOB_SECRET not configured`);
            throw new UnauthorizedException('Job secret not configured');
        }

        const provided = req.headers['x-internal-job-secret'] as string;
        if (!provided || provided !== expected) {
            this.logger.warn(`[${req['requestId'] || 'no-id'}] Invalid job secret`);
            throw new UnauthorizedException('Invalid job secret');
        }
    }
}
