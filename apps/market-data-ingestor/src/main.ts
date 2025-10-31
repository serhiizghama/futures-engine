import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  try {
    // Create NestJS application (headless, no HTTP server)
    const app = await NestFactory.createApplicationContext(AppModule, {
      logger: ['log', 'error', 'warn', 'debug', 'verbose'],
    });

    // Enable shutdown hooks
    app.enableShutdownHooks();

    logger.log('Market data ingestor is running');

    // Keep the process alive
    process.on('SIGINT', async () => {
      logger.log('Received SIGINT, shutting down...');
      await app.close();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      logger.log('Received SIGTERM, shutting down...');
      await app.close();
      process.exit(0);
    });
  } catch (error) {
    logger.error('Failed to start application', error);
    process.exit(1);
  }
}

bootstrap();
