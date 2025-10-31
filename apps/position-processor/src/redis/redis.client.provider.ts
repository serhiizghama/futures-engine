import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisClient } from '@futures-engine/redis';

@Injectable()
export class RedisClientProvider implements OnModuleInit, OnModuleDestroy {
  private client: RedisClient;

  constructor(private readonly configService: ConfigService) {
    const url = this.configService.get<string>('REDIS_URL', 'redis://localhost:6379');
    this.client = new RedisClient({ url });
  }

  async onModuleInit() {
    await this.client.connect();
  }

  async onModuleDestroy() {
    await this.client.disconnect();
  }

  getClient(): RedisClient {
    return this.client;
  }
}
