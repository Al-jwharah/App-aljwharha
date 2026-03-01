import { Body, Controller, Get, Header, Param, Patch, Query, Req, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { AuthGuard } from '../auth/guards/auth.guard';
import { RoleGuard, Roles } from '../auth/guards/role.guard';
import { OwnerService } from './owner.service';
import { UpdateUserRoleDto } from './dto/update-user-role.dto';
import { UpdateOwnerSettingsDto } from './dto/update-owner-settings.dto';

@Controller('owner')
@UseGuards(AuthGuard, RoleGuard)
@Roles('SUPERADMIN')
export class OwnerController {
    constructor(private readonly ownerService: OwnerService) { }

    @Get('dashboard')
    dashboard() {
        return this.ownerService.dashboard();
    }

    @Get('users')
    users(@Query('page') page?: string, @Query('pageSize') pageSize?: string, @Query('q') q?: string) {
        return this.ownerService.listUsers(
            page ? parseInt(page, 10) : 1,
            pageSize ? parseInt(pageSize, 10) : 50,
            q,
        );
    }

    @Patch('users/:id/role')
    updateRole(@Param('id') id: string, @Body() dto: UpdateUserRoleDto, @Req() req: any) {
        return this.ownerService.updateUserRole(id, dto.role, dto.reason, req.user.userId);
    }

    @Get('settings')
    settings() {
        return this.ownerService.getSettings();
    }

    @Patch('settings')
    updateSettings(@Body() dto: UpdateOwnerSettingsDto, @Req() req: any) {
        return this.ownerService.updateSettings(dto, req.user.userId);
    }

    @Get('risk')
    risk() {
        return this.ownerService.riskCenter();
    }

    @Get('ops')
    ops() {
        return this.ownerService.opsCenter();
    }

    @Get('exports/:entity')
    async exportEntity(@Param('entity') entity: string, @Res() res: Response) {
        const exported = await this.ownerService.exportEntity(entity);
        res.setHeader('Content-Type', exported.contentType);
        res.setHeader('Content-Disposition', `attachment; filename=\"${exported.filename}\"`);
        res.send(exported.csv);
    }
}
