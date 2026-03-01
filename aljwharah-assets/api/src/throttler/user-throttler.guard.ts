import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { createHash } from 'crypto';

@Injectable()
export class UserThrottlerGuard extends ThrottlerGuard {
    protected async getTracker(req: Record<string, any>): Promise<string> {
        const userId = req?.user?.userId || req?.user?.sub;
        if (userId) return `user:${userId}`;

        const authHeader = req?.headers?.authorization;
        if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
            const token = authHeader.substring(7);
            const digest = createHash('sha256').update(token).digest('hex').slice(0, 24);
            return `token:${digest}`;
        }

        return String(req?.ip || req?.ips?.[0] || req?.socket?.remoteAddress || 'anon');
    }
}