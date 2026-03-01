import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger, ValidationPipe } from '@nestjs/common';
import { GlobalExceptionFilter } from './filters/global-exception.filter';
import helmet from 'helmet';

async function bootstrap() {
    const logger = new Logger('Bootstrap');

    const app = await NestFactory.create(AppModule, {
        rawBody: true,
    });

    // ── Security Headers ──
    app.use(helmet({
        contentSecurityPolicy: false, // Managed separately; avoid breaking CORS
        crossOriginEmbedderPolicy: false,
    }));

    // ── Global Validation ──
    app.useGlobalPipes(
        new ValidationPipe({
            whitelist: true,
            forbidNonWhitelisted: true,
            transform: true,
            transformOptions: { enableImplicitConversion: true },
            stopAtFirstError: true,
        }),
    );

    // ── Global Exception Filter ──
    app.useGlobalFilters(new GlobalExceptionFilter());

    app.enableCors({
        origin: process.env.WEB_URL || '*',
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'x-request-id', 'x-internal-job-secret'],
    });

    const port = process.env.PORT || 8080;
    await app.listen(port, '0.0.0.0');
    logger.log(`🚀 API running on http://0.0.0.0:${port}`);
}

bootstrap().catch((err) => {
    const logger = new Logger('Bootstrap');
    logger.error('Failed to start', err);
    process.exit(1);
});
