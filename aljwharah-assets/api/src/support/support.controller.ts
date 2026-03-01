import {
    Body,
    Controller,
    Get,
    Param,
    Patch,
    Post,
    Query,
    Req,
    UseGuards,
    ParseUUIDPipe,
} from '@nestjs/common';
import { SupportService } from './support.service';
import { AuthGuard } from '../auth/guards/auth.guard';
import { RoleGuard, Roles } from '../auth/guards/role.guard';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { AddTicketMessageDto } from './dto/add-ticket-message.dto';
import { AssignTicketDto } from './dto/assign-ticket.dto';
import { UpdateTicketStatusDto } from './dto/update-ticket-status.dto';

@Controller('support')
@UseGuards(AuthGuard)
export class SupportController {
    constructor(private readonly supportService: SupportService) { }

    @Post('tickets')
    createTicket(@Req() req: any, @Body() dto: CreateTicketDto) {
        return this.supportService.createTicket(req.user.userId, dto);
    }

    @Get('tickets')
    listMyTickets(@Req() req: any) {
        return this.supportService.listUserTickets(req.user.userId);
    }

    @Get('tickets/:id')
    getMyTicket(@Req() req: any, @Param('id', ParseUUIDPipe) id: string) {
        return this.supportService.getUserTicket(id, req.user.userId);
    }

    @Post('tickets/:id/messages')
    addMyMessage(
        @Req() req: any,
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: AddTicketMessageDto,
    ) {
        return this.supportService.addUserMessage(id, req.user.userId, dto.message, dto.attachments);
    }
}

@Controller('admin/support')
@UseGuards(AuthGuard, RoleGuard)
@Roles('ADMIN', 'SUPERADMIN', 'AGENT')
export class AdminSupportController {
    constructor(private readonly supportService: SupportService) { }

    @Get('tickets')
    listTickets(
        @Query('status') status?: string,
        @Query('q') q?: string,
        @Query('category') category?: string,
        @Query('priority') priority?: string,
        @Query('page') page?: string,
        @Query('pageSize') pageSize?: string,
    ) {
        return this.supportService.listAdminTickets({
            status,
            q,
            category,
            priority,
            page: page ? parseInt(page, 10) : 1,
            pageSize: pageSize ? parseInt(pageSize, 10) : 20,
        });
    }

    @Get('tickets/:id')
    getTicket(@Param('id', ParseUUIDPipe) id: string) {
        return this.supportService.getAdminTicket(id);
    }

    @Patch('tickets/:id/assign')
    assign(
        @Req() req: any,
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: AssignTicketDto,
    ) {
        return this.supportService.assignTicket(
            id,
            dto.agentUserId,
            dto.reason,
            req.user.userId,
            req.user.role,
        );
    }

    @Patch('tickets/:id/status')
    updateStatus(
        @Req() req: any,
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: UpdateTicketStatusDto,
    ) {
        return this.supportService.updateTicketStatus(
            id,
            dto.status,
            dto.reason,
            req.user.userId,
            req.user.role,
        );
    }

    @Post('tickets/:id/message')
    addMessage(
        @Req() req: any,
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: AddTicketMessageDto,
    ) {
        return this.supportService.addAdminMessage(id, req.user.userId, req.user.role, dto.message, dto.attachments);
    }
}
