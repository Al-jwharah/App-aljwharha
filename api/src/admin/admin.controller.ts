import {
    Controller,
    Get,
    Patch,
    Post,
    Query,
    Param,
    Body,
    Req,
    UseGuards,
    ParseUUIDPipe,
    HttpCode,
    HttpStatus,
} from '@nestjs/common';
import { AuthGuard } from '../auth/guards/auth.guard';
import { RoleGuard, Roles } from '../auth/guards/role.guard';
import { AdminService } from './admin.service';
import { AdminOrdersService } from './admin-orders.service';
import { SettingsService } from './settings.service';
import { RevenueService } from './revenue.service';
import { AuditService } from '../audit/audit.service';
import { SellerService } from '../seller/seller.service';
import { AdminReasonDto, AdminRefundDto, AdminNoteDto } from './dto/admin.dto';
import { UpdateSettingsDto } from './dto/settings.dto';

@Controller('admin')
@UseGuards(AuthGuard, RoleGuard)
@Roles('ADMIN')
export class AdminController {
    constructor(
        private readonly adminService: AdminService,
        private readonly adminOrdersService: AdminOrdersService,
        private readonly settingsService: SettingsService,
        private readonly revenueService: RevenueService,
        private readonly auditService: AuditService,
        private readonly sellerService: SellerService,
    ) { }

    // ── Listings ──
    @Get('listings')
    getListings(
        @Query('status') status?: string,
        @Query('q') q?: string,
        @Query('ownerId') ownerId?: string,
        @Query('page') page?: string,
        @Query('pageSize') pageSize?: string,
    ) {
        return this.adminService.listListings({
            status,
            q,
            ownerId,
            page: this.parsePositiveInt(page, 1),
            pageSize: this.parsePositiveInt(pageSize, 20),
        });
    }

    @Get('listings/pending')
    getPending() {
        return this.adminService.getPendingListings();
    }

    @Patch('listings/:id/approve')
    @HttpCode(HttpStatus.OK)
    async approve(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
        const result = await this.adminService.approveListing(id, req.user.userId);
        await this.auditService.log({
            actorUserId: req.user.userId,
            actorRole: req.user.role,
            action: 'listing.approve',
            entityType: 'listing',
            entityId: id,
            meta: {
                requestId: req['requestId'],
                listingId: id,
            },
        });
        return result;
    }

    @Patch('listings/:id/reject')
    @HttpCode(HttpStatus.OK)
    async reject(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: AdminReasonDto,
        @Req() req: any,
    ) {
        const result = await this.adminService.rejectListing(id, dto.reason, req.user.userId);
        await this.auditService.log({
            actorUserId: req.user.userId,
            actorRole: req.user.role,
            action: 'listing.reject',
            entityType: 'listing',
            entityId: id,
            meta: {
                requestId: req['requestId'],
                listingId: id,
                reason: dto.reason,
            },
        });
        return result;
    }

    // ── Orders Visibility ──
    @Get('orders')
    getOrders(
        @Query('status') status?: string,
        @Query('q') q?: string,
        @Query('page') page?: string,
        @Query('pageSize') pageSize?: string,
    ) {
        return this.adminService.listOrders({
            status,
            q,
            page: this.parsePositiveInt(page, 1),
            pageSize: this.parsePositiveInt(pageSize, 20),
        });
    }

    @Get('orders/:id')
    getOrder(@Param('id', ParseUUIDPipe) id: string) {
        return this.adminService.getOrderById(id);
    }

    // ── Admin Actions ──
    @Patch('orders/:id/mark-paid')
    @HttpCode(HttpStatus.OK)
    markPaid(@Param('id', ParseUUIDPipe) id: string, @Body() dto: AdminReasonDto, @Req() req: any) {
        return this.adminOrdersService.markPaid(id, dto.reason, req.user.userId);
    }

    @Patch('orders/:id/cancel')
    @HttpCode(HttpStatus.OK)
    cancelOrder(@Param('id', ParseUUIDPipe) id: string, @Body() dto: AdminReasonDto, @Req() req: any) {
        return this.adminOrdersService.cancelOrder(id, dto.reason, req.user.userId);
    }

    @Post('orders/:id/reconcile')
    @HttpCode(HttpStatus.OK)
    reconcileOrder(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
        return this.adminOrdersService.reconcileOrder(id, req.user.userId);
    }

    @Post('orders/:id/add-note')
    @HttpCode(HttpStatus.OK)
    addOrderNote(@Param('id', ParseUUIDPipe) id: string, @Body() dto: AdminNoteDto, @Req() req: any) {
        return this.adminOrdersService.addNote(id, dto.note, req.user.userId, req.user.role);
    }

    @Patch('orders/:id/mark-refunded')
    @HttpCode(HttpStatus.OK)
    markRefunded(@Param('id', ParseUUIDPipe) id: string, @Body() dto: AdminRefundDto, @Req() req: any) {
        return this.adminOrdersService.markRefunded(id, dto.reason, dto.amount, dto.currency, req.user.userId);
    }

    // ── Payout Requests ──
    @Get('payout-requests')
    getPayoutRequests(
        @Query('status') status?: string,
        @Query('q') q?: string,
        @Query('page') page?: string,
        @Query('pageSize') pageSize?: string,
    ) {
        return this.sellerService.listPayoutRequests({
            status,
            q,
            page: this.parsePositiveInt(page, 1),
            pageSize: this.parsePositiveInt(pageSize, 20),
        });
    }

    @Patch('payout-requests/:id/approve')
    @HttpCode(HttpStatus.OK)
    approvePayoutRequest(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
        return this.sellerService.approvePayoutRequest(id, req.user.userId);
    }

    @Patch('payout-requests/:id/reject')
    @HttpCode(HttpStatus.OK)
    rejectPayoutRequest(@Param('id', ParseUUIDPipe) id: string, @Body() dto: AdminReasonDto, @Req() req: any) {
        return this.sellerService.rejectPayoutRequest(id, dto.reason, req.user.userId);
    }

    // ── Audit Viewer ──
    @Get('audit')
    getAudit(
        @Query('q') q?: string,
        @Query('action') action?: string,
        @Query('entityType') entityType?: string,
        @Query('page') page?: string,
        @Query('pageSize') pageSize?: string,
    ) {
        return this.adminService.listAudit({
            q,
            action,
            entityType,
            page: this.parsePositiveInt(page, 1),
            pageSize: this.parsePositiveInt(pageSize, 20),
        });
    }

    // ── Settings ──
    @Get('settings')
    getSettings() {
        return this.settingsService.getSettings();
    }

    @Patch('settings')
    @HttpCode(HttpStatus.OK)
    updateSettings(@Body() dto: UpdateSettingsDto, @Req() req: any) {
        return this.settingsService.updateSettings(dto.commission_bps, dto.minimum_fee ?? 0, req.user.userId);
    }

    // ── Revenue ──
    @Get('revenue/summary')
    getRevenue(@Query('from') from: string, @Query('to') to: string) {
        const now = new Date();
        const f = from || new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
        const t = to || now.toISOString();
        return this.revenueService.getSummary(f, t);
    }

    private parsePositiveInt(value: string | undefined, fallback: number) {
        if (!value) return fallback;
        const parsed = parseInt(value, 10);
        if (Number.isNaN(parsed) || parsed < 1) return fallback;
        return parsed;
    }
}
