import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
    private readonly logger = new Logger('RequestId');

    use(req: Request, res: Response, next: NextFunction) {
        const requestId = (req.headers['x-request-id'] as string) || randomUUID();
        req['requestId'] = requestId;
        res.setHeader('x-request-id', requestId);
        next();
    }
}
