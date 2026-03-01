import { Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
import { SsoService } from './sso.service';
import { AuthGuard } from '../auth/guards/auth.guard';

@Controller('auth/sso')
export class SsoController {
    constructor(private readonly ssoService: SsoService) { }

    @Get(':provider/start')
    startLogin(
        @Param('provider') provider: 'google' | 'microsoft',
        @Query('redirectUri') redirectUri?: string,
    ) {
        return this.ssoService.buildStart(provider, 'login', redirectUri);
    }

    @Get(':provider/link/start')
    @UseGuards(AuthGuard)
    startLink(
        @Param('provider') provider: 'google' | 'microsoft',
        @Query('redirectUri') redirectUri: string,
        @Req() req: any,
    ) {
        return this.ssoService.buildStart(provider, 'link', redirectUri, req.user.userId);
    }

    @Get(':provider/callback')
    callback(
        @Param('provider') provider: 'google' | 'microsoft',
        @Query('code') code: string,
        @Query('state') state: string,
    ) {
        return this.ssoService.handleCallback(provider, code, state);
    }
}
