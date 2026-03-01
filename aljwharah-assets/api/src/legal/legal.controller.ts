import { Body, Controller, Get, Patch, Post, Query, Req, UseGuards, Param, ParseUUIDPipe } from '@nestjs/common';
import { AuthGuard } from '../auth/guards/auth.guard';
import { RoleGuard, Roles } from '../auth/guards/role.guard';
import { LegalService } from './legal.service';
import { CreateInfringementReportDto } from './dto/create-infringement-report.dto';
import { ResolveInfringementReportDto } from './dto/resolve-infringement-report.dto';

@Controller('legal')
@UseGuards(AuthGuard)
export class LegalController {
    constructor(private readonly legalService: LegalService) { }

    @Post('reports')
    createReport(@Req() req: any, @Body() dto: CreateInfringementReportDto) {
        return this.legalService.createReport(req.user.userId, dto.listingId, dto.reason, dto.details);
    }
}

@Controller('admin/legal')
@UseGuards(AuthGuard, RoleGuard)
@Roles('ADMIN', 'SUPERADMIN')
export class AdminLegalController {
    constructor(private readonly legalService: LegalService) { }

    @Get('reports')
    listReports(
        @Query('status') status?: string,
        @Query('q') q?: string,
        @Query('page') page?: string,
        @Query('pageSize') pageSize?: string,
    ) {
        return this.legalService.listReports({
            status,
            q,
            page: page ? parseInt(page, 10) : 1,
            pageSize: pageSize ? parseInt(pageSize, 10) : 20,
        });
    }

    @Patch('reports/:id/resolve')
    resolveReport(@Req() req: any, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ResolveInfringementReportDto) {
        return this.legalService.resolveReport(id, dto, req.user.userId, req.user.role);
    }
}
