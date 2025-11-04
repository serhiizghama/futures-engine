import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  try {
    // Create NestJS application without HTTP server (headless worker)
    const app = await NestFactory.createApplicationContext(AppModule, {
      logger: ['log', 'error', 'warn', 'debug', 'verbose'],
    });

    // Enable graceful shutdown
    app.enableShutdownHooks();

    logger.log('Risk Engine Service started successfully');

    // Keep the process running
    process.on('SIGTERM', async () => {
      logger.log('SIGTERM signal received: closing application');
      await app.close();
      process.exit(0);
    });

    process.on('SIGINT', async () => {
      logger.log('SIGINT signal received: closing application');
      await app.close();
      process.exit(0);
    });
  } catch (error) {
    const err = error as Error;
    logger.error(`Failed to start application: ${err.message}`, err.stack);
    process.exit(1);
  }
}

bootstrap();
