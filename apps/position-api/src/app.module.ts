import { Module, OnModuleInit, OnModuleDestroy, Logger, Inject } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { KafkaProducer } from '@futures-engine/kafka';
import { RedisClient } from '@futures-engine/redis';
import { PgClient } from '@futures-engine/pg';
import { InfrastructureModule } from './infrastructure/infrastructure.module';
import { HealthModule } from './health/health.module';
import { PositionsModule } from './positions/positions.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '.env.local'],
    }),
    InfrastructureModule,
    HealthModule,
    PositionsModule,
  ],
})
export class AppModule implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AppModule.name);

  constructor(
    @Inject('KAFKA_PRODUCER')
    private readonly kafkaProducer: KafkaProducer,
    @Inject('REDIS_CLIENT')
    private readonly redisClient: RedisClient,
    @Inject('PG_CLIENT')
    private readonly pgClient: PgClient,
  ) {}

  async onModuleInit() {
    this.logger.log('Initializing position-api module...');

    try {
      // Connect to Kafka
      await this.kafkaProducer.connect();
      this.logger.log('Kafka producer connected');

      // Connect to Redis
      await this.redisClient.connect();
      this.logger.log('Redis client connected');

      // Connect to PostgreSQL
      await this.pgClient.connect();
      this.logger.log('PostgreSQL client connected');

      this.logger.log('All dependencies initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize dependencies', error);
      throw error;
    }
  }

  async onModuleDestroy() {
    this.logger.log('Shutting down position-api module...');

    try {
      await this.kafkaProducer.disconnect();
      await this.redisClient.disconnect();
      await this.pgClient.disconnect();
      this.logger.log('All connections closed gracefully');
    } catch (error) {
      this.logger.error('Error during shutdown', error);
    }
  }
}
