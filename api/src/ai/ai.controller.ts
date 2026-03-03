import {
    Body,
    Controller,
    Post,
    Req,
    UseGuards,
} from '@nestjs/common';
import { AiService } from './ai.service';
import { AiSearchDto } from './dto/ai-search.dto';
import { AiListingImproveDto } from './dto/ai-listing-improve.dto';
import { AiSupportDraftDto } from './dto/ai-support-draft.dto';
import { AuthGuard } from '../auth/guards/auth.guard';
import { RoleGuard, Roles } from '../auth/guards/role.guard';
import { AuthService } from '../auth/auth.service';

@Controller('ai')
export class AiController {
    constructor(
        private readonly aiService: AiService,
        private readonly authService: AuthService,
    ) { }

    @Post('search')
    async search(@Body() dto: AiSearchDto, @Req() req: any) {
        const token = this.extractToken(req?.headers?.authorization as string | undefined);
        let userId: string | null = null;
        if (token) {
            try {
                const payload = await this.authService.verifyAccessToken(token);
                userId = payload.userId;
            } catch {
                userId = null;
            }
        }
        return this.aiService.search(dto.query, userId, dto.locale || 'ar');
    }

    @Post('listing-improve')
    @UseGuards(AuthGuard)
    improveListing(@Req() req: any, @Body() dto: AiListingImproveDto) {
        return this.aiService.improveListing(req.user.userId, dto);
    }

    @Post('support-draft')
    @UseGuards(AuthGuard, RoleGuard)
    @Roles('ADMIN', 'SUPERADMIN', 'AGENT')
    supportDraft(@Req() req: any, @Body() dto: AiSupportDraftDto) {
        return this.aiService.supportDraft(req.user.userId, dto.ticketId, dto.userMessage, dto.locale || 'ar');
    }

    @Post('admin-insights')
    @UseGuards(AuthGuard, RoleGuard)
    @Roles('ADMIN', 'SUPERADMIN')
    adminInsights(@Req() req: any) {
        return this.aiService.adminInsights(req.user.userId);
    }

    @Post('agent-report')
    @UseGuards(AuthGuard, RoleGuard)
    @Roles('ADMIN', 'SUPERADMIN', 'AGENT')
    agentReport(@Req() req: any) {
        return this.aiService.agentReport(req.user.userId);
    }

    private extractToken(authHeader?: string) {
        if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
        const token = authHeader.substring(7).trim();
        return token || null;
    }
}


