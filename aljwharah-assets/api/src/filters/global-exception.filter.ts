import {
    ExceptionFilter,
    Catch,
    ArgumentsHost,
    HttpException,
    HttpStatus,
    Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
    private readonly logger = new Logger('ExceptionFilter');
    private readonly isProd = process.env.NODE_ENV === 'production';

    catch(exception: unknown, host: ArgumentsHost) {
        const ctx = host.switchToHttp();
        const request = ctx.getRequest<Request>();
        const response = ctx.getResponse<Response>();
        const requestId = request['requestId'] || '-';

        let status = HttpStatus.INTERNAL_SERVER_ERROR;
        let message = 'حدث خطأ غير متوقع';
        let error = 'Internal Server Error';

        if (exception instanceof HttpException) {
            status = exception.getStatus();
            const exRes = exception.getResponse();

            if (typeof exRes === 'string') {
                message = exRes;
            } else if (typeof exRes === 'object' && exRes !== null) {
                const obj = exRes as Record<string, any>;
                message = obj.message || message;
                error = obj.error || error;

                // class-validator returns message as array
                if (Array.isArray(message)) {
                    message = message[0];
                }
            }

            error = this.httpStatusToError(status) || error;
        } else {
            // Unexpected error — log full details, return safe message
            const err = exception instanceof Error ? exception : new Error(String(exception));
            this.logger.error(
                JSON.stringify({
                    requestId,
                    error: err.message,
                    stack: this.isProd ? undefined : err.stack,
                    path: request.originalUrl,
                }),
            );
        }

        const body: Record<string, any> = {
            statusCode: status,
            error,
            message,
            requestId,
        };

        // Never include stack in response
        response.status(status).json(body);
    }

    private httpStatusToError(status: number): string | null {
        const map: Record<number, string> = {
            400: 'Bad Request',
            401: 'Unauthorized',
            403: 'Forbidden',
            404: 'Not Found',
            409: 'Conflict',
            429: 'Too Many Requests',
        };
        return map[status] || null;
    }
}
