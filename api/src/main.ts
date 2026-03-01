import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger, ValidationPipe } from '@nestjs/common';

async function bootstrap() {
    const logger = new Logger('Bootstrap');

    const app = await NestFactory.create(AppModule, {
        rawBody: true, // Enable raw body for webhook signature verification
    });

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

    app.enableCors({
        origin: process.env.WEB_URL || '*',
        credentials: true,
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
