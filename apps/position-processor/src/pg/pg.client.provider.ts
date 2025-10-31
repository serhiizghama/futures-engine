import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PgClient } from '@futures-engine/pg';

@Injectable()
export class PgClientProvider implements OnModuleInit, OnModuleDestroy {
  private client: PgClient;

  constructor(private readonly configService: ConfigService) {
    const connectionString = this.buildConnectionString();
    this.client = new PgClient({ connectionString });
  }

  async onModuleInit() {
    await this.client.connect();
  }

  async onModuleDestroy() {
    await this.client.disconnect();
  }

  getClient(): PgClient {
    return this.client;
  }

  private buildConnectionString(): string {
    const databaseUrl = this.configService.get<string>('DATABASE_URL');
    if (databaseUrl) {
      return databaseUrl;
    }

    const host = this.configService.get<string>('PGHOST', 'localhost');
    const port = this.configService.get<string>('PGPORT', '5432');
    const user = this.configService.get<string>('PGUSER', 'futures');
    const password = this.configService.get<string>('PGPASSWORD', 'futures');
    const database = this.configService.get<string>('PGDATABASE', 'futures');

    return `postgresql://${user}:${password}@${host}:${port}/${database}`;
  }
}
