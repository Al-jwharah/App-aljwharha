import {
    Controller,
    Get,
    Post,
    Put,
    Delete,
    Param,
    Body,
    Query,
    Req,
    UseGuards,
    ParseUUIDPipe,
    ForbiddenException,
    HttpCode,
    HttpStatus,
} from '@nestjs/common';
import { ListingsService } from './listings.service';
import { CreateListingDto } from './dto/create-listing.dto';
import { AuthGuard } from '../auth/guards/auth.guard';

@Controller('listings')
export class ListingsController {
    constructor(private readonly listingsService: ListingsService) { }

    @Post()
    @UseGuards(AuthGuard)
    create(@Body() dto: CreateListingDto, @Req() req: any) {
        dto.ownerId = req.user.userId;
        return this.listingsService.create(dto);
    }

    @Get()
    findAll(
        @Query('type') type?: string,
        @Query('status') status?: string,
        @Query('categoryId') categoryId?: string,
        @Query('page') page?: string,
        @Query('limit') limit?: string,
    ) {
        return this.listingsService.findAll({
            type,
            status,
            categoryId: categoryId ? parseInt(categoryId, 10) : undefined,
            page: page ? parseInt(page, 10) : 1,
            limit: limit ? parseInt(limit, 10) : 20,
        });
    }

    @Get('my')
    @UseGuards(AuthGuard)
    findMine(@Req() req: any) {
        return this.listingsService.findByOwner(req.user.userId);
    }

    @Get(':id')
    findOne(@Param('id', ParseUUIDPipe) id: string) {
        return this.listingsService.findOne(id);
    }

    @Put(':id')
    @UseGuards(AuthGuard)
    async update(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: Partial<CreateListingDto>,
        @Req() req: any,
    ) {
        await this.assertOwnership(id, req.user);
        return this.listingsService.update(id, dto);
    }

    @Delete(':id')
    @UseGuards(AuthGuard)
    @HttpCode(HttpStatus.NO_CONTENT)
    async remove(
        @Param('id', ParseUUIDPipe) id: string,
        @Req() req: any,
    ) {
        await this.assertOwnership(id, req.user);
        return this.listingsService.remove(id);
    }

    private async assertOwnership(listingId: string, user: { userId: string; role: string }) {
        if (user.role === 'ADMIN') return;
        const listing = await this.listingsService.findOne(listingId);
        if (listing.owner_id !== user.userId) {
            throw new ForbiddenException('لا يمكنك تعديل إعلان لا تملكه');
        }
    }
}
