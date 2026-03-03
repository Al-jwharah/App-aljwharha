import { Injectable, Inject, ConflictException, UnauthorizedException, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DATABASE_POOL } from '../database/database.module';
import * as bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';
import * as crypto from 'crypto';

@Injectable()
export class AuthService {
    private readonly logger = new Logger(AuthService.name);
    private readonly jwtSecret: string;

    constructor(
        @Inject(DATABASE_POOL) private readonly pool: any,
        private readonly config: ConfigService,
    ) {
        this.jwtSecret = this.config.get<string>('JWT_SECRET') || 'aljwharah-dev-secret-change-me';
    }

    async register(email: string, password: string, name: string) {
        const existing = await this.pool.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
        if (existing.rows.length > 0) {
            throw new ConflictException('البريد الإلكتروني مسجل مسبقاً');
        }
        const passwordHash = await bcrypt.hash(password, 12);
        const { rows } = await this.pool.query(
            `INSERT INTO users (email, password_hash, name, role) VALUES ($1, $2, $3, 'USER') RETURNING id, email, name, role, created_at`,
            [email.toLowerCase(), passwordHash, name],
        );
        const user = rows[0];
        const tokens = await this.generateTokens(user.id, user.role);
        this.logger.log(`User registered: ${user.email}`);
        return { user, ...tokens };
    }

    async login(email: string, password: string) {
        const { rows } = await this.pool.query(
            'SELECT id, email, name, role, password_hash FROM users WHERE email = $1',
            [email.toLowerCase()],
        );
        if (rows.length === 0) throw new UnauthorizedException('بيانات الدخول غير صحيحة');
        const user = rows[0];
        if (!user.password_hash) throw new UnauthorizedException('بيانات الدخول غير صحيحة');
        const valid = await bcrypt.compare(password, user.password_hash);
        if (!valid) throw new UnauthorizedException('بيانات الدخول غير صحيحة');
        const tokens = await this.generateTokens(user.id, user.role);
        const { password_hash, ...safeUser } = user;
        this.logger.log(`User logged in: ${user.email}`);
        return { user: safeUser, ...tokens };
    }

    async refresh(refreshToken: string) {
        const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
        const { rows } = await this.pool.query(
            'SELECT rt.*, u.role FROM refresh_tokens rt JOIN users u ON rt.user_id = u.id WHERE rt.token_hash = $1 AND rt.revoked = false AND rt.expires_at > NOW()',
            [tokenHash],
        );
        if (rows.length === 0) throw new UnauthorizedException('رمز التحديث غير صالح أو منتهي');
        const record = rows[0];
        await this.pool.query('UPDATE refresh_tokens SET revoked = true WHERE id = $1', [record.id]);
        return this.generateTokens(record.user_id, record.role);
    }

    async logout(refreshToken: string) {
        const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
        await this.pool.query('UPDATE refresh_tokens SET revoked = true WHERE token_hash = $1', [tokenHash]);
        return { success: true };
    }

    async verifyAccessToken(token: string): Promise<{ userId: string; role: string }> {
        try {
            const payload = jwt.verify(token, this.jwtSecret) as any;
            return { userId: payload.sub, role: payload.role };
        } catch {
            throw new UnauthorizedException('رمز الوصول غير صالح');
        }
    }

    async issueTokensForUser(userId: string, role: string) {
        return this.generateTokens(userId, role);
    }

    async getUserById(userId: string) {
        const { rows } = await this.pool.query(
            'SELECT id, email, phone, name, role, created_at FROM users WHERE id = $1',
            [userId],
        );
        if (rows.length === 0) throw new NotFoundException('المستخدم غير موجود');
        return rows[0];
    }

    /* ═══════ GOOGLE OAUTH ═══════ */
    getGoogleAuthUrl(): string {
        const clientId = this.config.get<string>('GOOGLE_CLIENT_ID');
        const redirectUri = this.config.get<string>('GOOGLE_REDIRECT_URI') || 'https://api.aljwharah.ai/auth/google/callback';
        if (!clientId) {
            return 'https://aljwharah.ai/sso?error=google_not_configured';
        }
        const params = new URLSearchParams({
            client_id: clientId,
            redirect_uri: redirectUri,
            response_type: 'code',
            scope: 'openid email profile',
            access_type: 'offline',
            prompt: 'consent',
        });
        return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    }

    async handleGoogleCallback(code: string): Promise<{ user: any; accessToken: string; refreshToken: string }> {
        const clientId = this.config.get<string>('GOOGLE_CLIENT_ID');
        const clientSecret = this.config.get<string>('GOOGLE_CLIENT_SECRET');
        const redirectUri = this.config.get<string>('GOOGLE_REDIRECT_URI') || 'https://api.aljwharah.ai/auth/google/callback';

        const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: 'authorization_code' }),
        });
        const tokenData = await tokenRes.json();
        if (!tokenData.access_token) throw new UnauthorizedException('فشل تسجيل الدخول عبر Google');

        const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
            headers: { Authorization: `Bearer ${tokenData.access_token}` },
        });
        const gUser = await userInfoRes.json();
        if (!gUser.email) throw new UnauthorizedException('لم يتم العثور على البريد الإلكتروني في حساب Google');

        let { rows } = await this.pool.query('SELECT id, email, name, role FROM users WHERE email = $1', [gUser.email.toLowerCase()]);
        let user;
        if (rows.length === 0) {
            const result = await this.pool.query(
                `INSERT INTO users (email, name, role, google_id) VALUES ($1, $2, 'USER', $3) RETURNING id, email, name, role, created_at`,
                [gUser.email.toLowerCase(), gUser.name || gUser.email.split('@')[0], gUser.id],
            );
            user = result.rows[0];
            this.logger.log(`New Google user: ${user.email}`);
        } else {
            user = rows[0];
            await this.pool.query('UPDATE users SET google_id = $1 WHERE id = $2', [gUser.id, user.id]).catch(() => { });
            this.logger.log(`Google login: ${user.email}`);
        }
        const tokens = await this.generateTokens(user.id, user.role);
        return { user, ...tokens };
    }

    /* ═══════ PHONE OTP via Google Identity Platform ═══════ */
    async sendOtp(phone: string): Promise<{ success: boolean; message: string; sessionInfo?: string }> {
        let normalized = phone.replace(/\s+/g, '');
        if (normalized.startsWith('0')) normalized = '+966' + normalized.slice(1);
        if (!normalized.startsWith('+')) normalized = '+966' + normalized;

        const apiKey = this.config.get<string>('GCP_API_KEY');
        if (!apiKey) {
            this.logger.error('GCP_API_KEY not configured');
            throw new UnauthorizedException('خدمة التحقق غير متوفرة حالياً');
        }

        try {
            // Use Identity Platform REST API to send real SMS
            const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:sendVerificationCode?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phoneNumber: normalized }),
            });
            const data = await res.json();

            if (data.error) {
                this.logger.error(`Identity Platform error: ${JSON.stringify(data.error)}`);
                throw new UnauthorizedException(data.error.message || 'فشل إرسال رمز التحقق');
            }

            if (!data.sessionInfo) {
                throw new UnauthorizedException('فشل إرسال الرسالة النصية');
            }

            // Store session info in DB for verification step
            try {
                await this.pool.query(`CREATE TABLE IF NOT EXISTS otp_sessions (
                    id SERIAL PRIMARY KEY, phone VARCHAR(20) NOT NULL, session_info TEXT NOT NULL,
                    created_at TIMESTAMPTZ DEFAULT NOW()
                )`);
            } catch { /* exists */ }

            await this.pool.query('DELETE FROM otp_sessions WHERE phone = $1', [normalized]);
            await this.pool.query('INSERT INTO otp_sessions (phone, session_info) VALUES ($1, $2)', [normalized, data.sessionInfo]);

            this.logger.log(`SMS sent to ${normalized} via Identity Platform`);
            return { success: true, message: 'تم إرسال رمز التحقق عبر SMS' };
        } catch (err: any) {
            if (err instanceof UnauthorizedException) throw err;
            this.logger.error(`SMS send failed: ${err.message}`);
            throw new UnauthorizedException('فشل إرسال رمز التحقق');
        }
    }

    async verifyOtp(phone: string, code: string): Promise<{ user: any; accessToken: string; refreshToken: string }> {
        let normalized = phone.replace(/\s+/g, '');
        if (normalized.startsWith('0')) normalized = '+966' + normalized.slice(1);
        if (!normalized.startsWith('+')) normalized = '+966' + normalized;

        const apiKey = this.config.get<string>('GCP_API_KEY');
        if (!apiKey) throw new UnauthorizedException('خدمة التحقق غير متوفرة');

        // Get session info from DB
        const { rows: sessions } = await this.pool.query(
            'SELECT session_info FROM otp_sessions WHERE phone = $1 ORDER BY created_at DESC LIMIT 1',
            [normalized],
        );
        if (sessions.length === 0) throw new UnauthorizedException('لم يتم إرسال رمز لهذا الرقم');

        // Verify with Identity Platform
        const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPhoneNumber?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionInfo: sessions[0].session_info, code }),
        });
        const data = await res.json();

        if (data.error) {
            this.logger.error(`OTP verify error: ${JSON.stringify(data.error)}`);
            throw new UnauthorizedException('رمز التحقق غير صحيح أو منتهي');
        }

        // Clean up session
        await this.pool.query('DELETE FROM otp_sessions WHERE phone = $1', [normalized]);

        // Find or create user
        let { rows } = await this.pool.query('SELECT id, email, phone, name, role FROM users WHERE phone = $1', [normalized]);
        let user;
        if (rows.length === 0) {
            const result = await this.pool.query(
                `INSERT INTO users (phone, name, role) VALUES ($1, $2, 'USER') RETURNING id, phone, name, role, created_at`,
                [normalized, 'مستخدم'],
            );
            user = result.rows[0];
            this.logger.log(`New phone user: ${normalized}`);
        } else {
            user = rows[0];
            this.logger.log(`Phone login: ${normalized}`);
        }
        const tokens = await this.generateTokens(user.id, user.role);
        return { user, ...tokens };
    }

    /* ═══════ FIREBASE TOKEN VERIFICATION ═══════ */
    async firebaseVerify(idToken: string, phone: string): Promise<{ user: any; accessToken: string; refreshToken: string }> {
        // Verify Firebase ID token via Google's API
        const apiKey = this.config.get<string>('GCP_API_KEY');
        const verifyRes = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idToken }),
        });
        const verifyData = await verifyRes.json();

        if (verifyData.error || !verifyData.users || verifyData.users.length === 0) {
            this.logger.error(`Firebase token verify failed: ${JSON.stringify(verifyData.error || 'no users')}`);
            throw new UnauthorizedException('رمز التحقق غير صالح');
        }

        const firebaseUser = verifyData.users[0];
        const normalizedPhone = firebaseUser.phoneNumber || phone;

        if (!normalizedPhone) {
            throw new UnauthorizedException('لم يتم العثور على رقم الجوال');
        }

        // Find or create user
        let { rows } = await this.pool.query('SELECT id, email, phone, name, role FROM users WHERE phone = $1', [normalizedPhone]);
        let user;
        if (rows.length === 0) {
            const result = await this.pool.query(
                `INSERT INTO users (phone, name, role) VALUES ($1, $2, 'USER') RETURNING id, phone, name, role, created_at`,
                [normalizedPhone, 'مستخدم'],
            );
            user = result.rows[0];
            this.logger.log(`New Firebase phone user: ${normalizedPhone}`);
        } else {
            user = rows[0];
            this.logger.log(`Firebase phone login: ${normalizedPhone}`);
        }
        const tokens = await this.generateTokens(user.id, user.role);
        return { user, ...tokens };
    }

    private async generateTokens(userId: string, role: string) {
        const accessToken = jwt.sign({ sub: userId, role }, this.jwtSecret, { expiresIn: '15m' });
        const refreshToken = crypto.randomBytes(40).toString('hex');
        const refreshHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        await this.pool.query('INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)', [userId, refreshHash, expiresAt]);
        return { accessToken, refreshToken };
    }
}
