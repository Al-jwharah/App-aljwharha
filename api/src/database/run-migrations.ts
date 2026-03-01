import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { MigrationRunner } from './migration-runner';

async function main() {
    const app = await NestFactory.createApplicationContext(AppModule);
    const runner = app.get(MigrationRunner);
    await runner.run();
    await app.close();
    process.exit(0);
}

main().catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
});
