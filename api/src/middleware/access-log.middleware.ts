import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class AccessLogMiddleware implements NestMiddleware {
    private readonly logger = new Logger('AccessLog');

    use(req: Request, res: Response, next: NextFunction) {
        const start = Date.now();
        const requestId = req['requestId'] || '-';

        res.on('finish', () => {
            const duration = Date.now() - start;
            const userId = req['user']?.userId || '-';

            const severity = res.statusCode >= 500 ? 'ERROR' : res.statusCode >= 400 ? 'WARNING' : 'INFO';
            const logEntry = {
                requestId,
                method: req.method,
                path: req.originalUrl,
                status: res.statusCode,
                duration_ms: duration,
                userId,
                ip: req.ip || req.socket.remoteAddress,
                userAgent: this.truncate(req.headers['user-agent'] || '-', 120),
                severity,
            };

            if (res.statusCode >= 500) {
                this.logger.error(JSON.stringify(logEntry));
            } else if (res.statusCode >= 400) {
                this.logger.warn(JSON.stringify(logEntry));
            } else {
                this.logger.log(JSON.stringify(logEntry));
            }
        });

        next();
    }

    private truncate(s: string, max: number): string {
        return s.length > max ? s.substring(0, max) + '…' : s;
    }
}
