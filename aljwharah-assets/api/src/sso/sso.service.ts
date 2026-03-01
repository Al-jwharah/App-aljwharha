import { Injectable, Inject, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DATABASE_POOL } from '../database/database.module';
import { AuthService } from '../auth/auth.service';
import { AuditService } from '../audit/audit.service';
import * as jwt from 'jsonwebtoken';

type Provider = 'google' | 'microsoft';

type StatePayload = {
    provider: Provider;
    mode: 'login' | 'link';
    userId?: string;
    redirectUri?: string;
};

@Injectable()
export class SsoService {
    private readonly stateSecret: string;

    constructor(
        @Inject(DATABASE_POOL) private readonly pool: any,
        private readonly configService: ConfigService,
        private readonly authService: AuthService,
        private readonly auditService: AuditService,
    ) {
        this.stateSecret = this.configService.get<string>('JWT_SECRET') || 'aljwharah-dev-secret-change-me';
    }

    buildStart(provider: Provider, mode: 'login' | 'link', redirectUri?: string, userId?: string) {
        const cfg = this.providerConfig(provider);
        const statePayload: StatePayload = {
            provider,
            mode,
            userId,
            redirectUri,
        };
        const state = jwt.sign(statePayload, this.stateSecret, { expiresIn: '10m' });

        const authParams = new URLSearchParams({
            client_id: cfg.clientId,
            response_type: 'code',
            redirect_uri: cfg.redirectUri,
            scope: 'openid email profile',
            state,
            prompt: 'select_account',
        });

        const authorizationUrl = `${cfg.authUrl}?${authParams.toString()}`;
        return { provider, mode, state, authorizationUrl };
    }

    async handleCallback(provider: Provider, code: string, state: string) {
        const cfg = this.providerConfig(provider);

        let payload: StatePayload;
        try {
            payload = jwt.verify(state, this.stateSecret) as StatePayload;
        } catch {
            throw new UnauthorizedException('حالة SSO غير صالحة');
        }

        if (payload.provider !== provider) {
            throw new UnauthorizedException('مزوّد SSO غير مطابق للحالة');
        }

        const tokenBody = new URLSearchParams({
            grant_type: 'authorization_code',
            code,
            client_id: cfg.clientId,
            client_secret: cfg.clientSecret,
            redirect_uri: cfg.redirectUri,
        });

        const tokenRes = await fetch(cfg.tokenUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: tokenBody.toString(),
        });

        const tokenData = await tokenRes.json();
        if (!tokenRes.ok) {
            throw new BadRequestException(tokenData.error_description || tokenData.error || 'فشل مصادقة SSO');
        }

        const accessToken = tokenData.access_token as string | undefined;
        if (!accessToken) throw new BadRequestException('لم يتم استلام access_token');

        const profileRes = await fetch(cfg.userInfoUrl, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        });

        const profile = await profileRes.json();
        if (!profileRes.ok) {
            throw new BadRequestException('تعذر قراءة ملف المستخدم من مزود SSO');
        }

        const sub = profile.sub as string | undefined;
        const email = (profile.email as string | undefined)?.toLowerCase();
        const name = (profile.name as string | undefined) || email || 'SSO User';

        if (!sub || !email) {
            throw new BadRequestException('بيانات الحساب من مزود SSO غير مكتملة');
        }

        await this.enforceDomainAllowlistIfEnabled(provider, email);

        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');

            const { rows: existingSsoRows } = await client.query(
                `SELECT sa.user_id, u.role
                 FROM sso_accounts sa
                 JOIN users u ON u.id = sa.user_id
                 WHERE sa.provider = $1 AND sa.provider_sub = $2
                 LIMIT 1`,
                [provider, sub],
            );

            let userId: string;
            let role = 'USER';

            if (existingSsoRows.length > 0) {
                userId = existingSsoRows[0].user_id;
                role = existingSsoRows[0].role;
            } else {
                if (payload.mode === 'link' && payload.userId) {
                    userId = payload.userId;
                    const { rows: userRows } = await client.query('SELECT role FROM users WHERE id = $1', [userId]);
                    if (userRows.length === 0) throw new UnauthorizedException('المستخدم غير موجود للربط');
                    role = userRows[0].role;
                } else {
                    const { rows: existingUserRows } = await client.query(
                        'SELECT id, role FROM users WHERE email = $1 LIMIT 1',
                        [email],
                    );
                    if (existingUserRows.length > 0) {
                        userId = existingUserRows[0].id;
                        role = existingUserRows[0].role;
                    } else {
                        const { rows: newUserRows } = await client.query(
                            `INSERT INTO users (email, name, role, is_verified)
                             VALUES ($1, $2, 'USER', true)
                             RETURNING id, role`,
                            [email, name],
                        );
                        userId = newUserRows[0].id;
                        role = newUserRows[0].role;
                    }
                }

                await client.query(
                    `INSERT INTO sso_accounts (user_id, provider, provider_sub, email)
                     VALUES ($1, $2, $3, $4)
                     ON CONFLICT (provider, provider_sub) DO NOTHING`,
                    [userId, provider, sub, email],
                );
            }

            await client.query('COMMIT');

            const tokens = await this.authService.issueTokensForUser(userId, role);
            const user = await this.authService.getUserById(userId);

            await this.auditService.log({
                actorUserId: userId,
                action: 'sso.login',
                entityType: 'sso_account',
                entityId: `${provider}:${sub}`,
                meta: { mode: payload.mode, email },
            });

            return {
                provider,
                mode: payload.mode,
                user,
                ...tokens,
                redirectUri: payload.redirectUri || null,
            };
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    }

    private providerConfig(provider: Provider) {
        if (provider === 'google') {
            return {
                clientId: this.configService.get<string>('GOOGLE_OIDC_CLIENT_ID') || '',
                clientSecret: this.configService.get<string>('GOOGLE_OIDC_CLIENT_SECRET') || '',
                redirectUri: this.configService.get<string>('GOOGLE_OIDC_REDIRECT_URI') || 'https://api.aljwharah.ai/auth/sso/google/callback',
                authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
                tokenUrl: 'https://oauth2.googleapis.com/token',
                userInfoUrl: 'https://openidconnect.googleapis.com/v1/userinfo',
            };
        }

        return {
            clientId: this.configService.get<string>('MICROSOFT_OIDC_CLIENT_ID') || '',
            clientSecret: this.configService.get<string>('MICROSOFT_OIDC_CLIENT_SECRET') || '',
            redirectUri: this.configService.get<string>('MICROSOFT_OIDC_REDIRECT_URI') || 'https://api.aljwharah.ai/auth/sso/microsoft/callback',
            authUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
            tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
            userInfoUrl: 'https://graph.microsoft.com/oidc/userinfo',
        };
    }

    private async enforceDomainAllowlistIfEnabled(provider: Provider, email: string) {
        const { rows: settingsRows } = await this.pool.query(
            'SELECT enforce_domain_allowlist FROM platform_settings WHERE id = 1',
        );

        const enforce = settingsRows.length > 0 ? Boolean(settingsRows[0].enforce_domain_allowlist) : false;
        if (!enforce) return;

        const domain = email.split('@')[1]?.toLowerCase();
        if (!domain) {
            throw new UnauthorizedException('البريد المستلم من SSO غير صالح');
        }

        const { rows } = await this.pool.query(
            `SELECT id
             FROM sso_domain_allowlist
             WHERE domain = $1
               AND (provider IS NULL OR provider = $2)
             LIMIT 1`,
            [domain, provider],
        );

        if (rows.length === 0) {
            throw new UnauthorizedException('الدومين غير مسموح به لهذه المؤسسة');
        }
    }
}
