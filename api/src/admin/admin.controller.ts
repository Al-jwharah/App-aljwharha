import { Controller, Get, Patch, Param, UseGuards, ParseUUIDPipe, HttpCode, HttpStatus } from '@nestjs/common';
import { AuthGuard } from '../auth/guards/auth.guard';
import { RoleGuard, Roles } from '../auth/guards/role.guard';
import { AdminService } from './admin.service';

@Controller('admin')
@UseGuards(AuthGuard, RoleGuard)
@Roles('ADMIN')
export class AdminController {
    constructor(private readonly adminService: AdminService) { }

    @Get('listings/pending')
    getPending() {
        return this.adminService.getPendingListings();
    }

    @Patch('listings/:id/approve')
    @HttpCode(HttpStatus.OK)
    approve(@Param('id', ParseUUIDPipe) id: string) {
        return this.adminService.approveListing(id);
    }

    @Patch('listings/:id/reject')
    @HttpCode(HttpStatus.OK)
    reject(@Param('id', ParseUUIDPipe) id: string) {
        return this.adminService.rejectListing(id);
    }
}
