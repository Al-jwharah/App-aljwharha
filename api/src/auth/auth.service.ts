import { Injectable, Inject, ConflictException, UnauthorizedException, Logger } from '@nestjs/common';
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

        if (rows.length === 0) {
            throw new UnauthorizedException('بيانات الدخول غير صحيحة');
        }

        const user = rows[0];
        if (!user.password_hash) {
            throw new UnauthorizedException('بيانات الدخول غير صحيحة');
        }

        const valid = await bcrypt.compare(password, user.password_hash);
        if (!valid) {
            throw new UnauthorizedException('بيانات الدخول غير صحيحة');
        }

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

        if (rows.length === 0) {
            throw new UnauthorizedException('رمز التحديث غير صالح أو منتهي');
        }

        const record = rows[0];
        // Revoke old token
        await this.pool.query('UPDATE refresh_tokens SET revoked = true WHERE id = $1', [record.id]);

        const tokens = await this.generateTokens(record.user_id, record.role);
        return tokens;
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

    private async generateTokens(userId: string, role: string) {
        const accessToken = jwt.sign(
            { sub: userId, role },
            this.jwtSecret,
            { expiresIn: '15m' },
        );

        const refreshToken = crypto.randomBytes(40).toString('hex');
        const refreshHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

        await this.pool.query(
            'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
            [userId, refreshHash, expiresAt],
        );

        return { accessToken, refreshToken };
    }
}
