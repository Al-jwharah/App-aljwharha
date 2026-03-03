import { Controller, Post, Get, Body, HttpCode, HttpStatus, Query, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { RegisterDto, LoginDto, RefreshDto, LogoutDto } from './dto/auth.dto';
import { Response } from 'express';

@Controller('auth')
export class AuthController {
    constructor(private readonly authService: AuthService) { }

    @Post('register')
    @Throttle({ default: { limit: 10, ttl: 60000 } })
    register(@Body() dto: RegisterDto) {
        return this.authService.register(dto.email, dto.password, dto.name);
    }

    @Post('login')
    @HttpCode(HttpStatus.OK)
    @Throttle({ default: { limit: 10, ttl: 60000 } })
    login(@Body() dto: LoginDto) {
        return this.authService.login(dto.email, dto.password);
    }

    @Post('refresh')
    @HttpCode(HttpStatus.OK)
    @Throttle({ default: { limit: 30, ttl: 60000 } })
    refresh(@Body() dto: RefreshDto) {
        return this.authService.refresh(dto.refreshToken);
    }

    @Post('logout')
    @HttpCode(HttpStatus.OK)
    logout(@Body() dto: LogoutDto) {
        return this.authService.logout(dto.refreshToken);
    }

    /* ═══════ GOOGLE OAUTH ═══════ */
    @Get('google/start')
    googleStart(@Res() res: Response) {
        const url = this.authService.getGoogleAuthUrl();
        return res.redirect(url);
    }

    @Get('google/callback')
    async googleCallback(@Query('code') code: string, @Res() res: Response) {
        try {
            const result = await this.authService.handleGoogleCallback(code);
            // Redirect to frontend with tokens
            const params = new URLSearchParams({
                token: result.accessToken,
                refresh: result.refreshToken,
            });
            return res.redirect(`https://aljwharah.ai/auth/callback?${params.toString()}`);
        } catch (err) {
            return res.redirect('https://aljwharah.ai/sso?error=google_failed');
        }
    }

    /* ═══════ PHONE OTP ═══════ */
    @Post('otp/send')
    @HttpCode(HttpStatus.OK)
    @Throttle({ default: { limit: 5, ttl: 60000 } })
    async sendOtp(@Body() body: { phone: string }) {
        return this.authService.sendOtp(body.phone);
    }

    @Post('otp/verify')
    @HttpCode(HttpStatus.OK)
    @Throttle({ default: { limit: 10, ttl: 60000 } })
    async verifyOtp(@Body() body: { phone: string; code: string }) {
        return this.authService.verifyOtp(body.phone, body.code);
    }

    /* ═══════ FIREBASE TOKEN VERIFY ═══════ */
    @Post('firebase/verify')
    @HttpCode(HttpStatus.OK)
    @Throttle({ default: { limit: 10, ttl: 60000 } })
    async firebaseVerify(@Body() body: { idToken: string; phone: string }) {
        return this.authService.firebaseVerify(body.idToken, body.phone);
    }
}
