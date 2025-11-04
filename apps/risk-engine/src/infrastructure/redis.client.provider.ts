import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisClient } from '@futures-engine/redis';

@Injectable()
export class RedisClientProvider implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisClientProvider.name);
  private client: RedisClient;

  constructor(private readonly configService: ConfigService) {
    const url = this.configService.get<string>('REDIS_URL', 'redis://localhost:6379');
    this.client = new RedisClient({ url });
  }

  async onModuleInit() {
    await this.client.connect();
    this.logger.log('Redis Client connected');
  }

  async onModuleDestroy() {
    await this.client.disconnect();
    this.logger.log('Redis Client disconnected');
  }

  getClient(): RedisClient {
    return this.client;
  }
}
