import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { KafkaProducer } from '@futures-engine/kafka';
import { RedisClient } from '@futures-engine/redis';
import { BinanceClient } from './binance.client';
import { IngestorService } from './ingestor.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
  ],
  providers: [
    // Kafka producer
    {
      provide: KafkaProducer,
      useFactory: (configService: ConfigService) => {
        const brokers = configService
          .get<string>('KAFKA_BROKERS', 'localhost:9092')
          .split(',')
          .map(b => b.trim());

        return new KafkaProducer({
          brokers,
          clientId: 'market-data-ingestor',
        });
      },
      inject: [ConfigService],
    },
    // Redis client
    {
      provide: RedisClient,
      useFactory: (configService: ConfigService) => {
        const url = configService.get<string>('REDIS_URL', 'redis://localhost:6379');
        return new RedisClient({ url });
      },
      inject: [ConfigService],
    },
    // Binance client
    BinanceClient,
    // Main service
    IngestorService,
  ],
})
export class AppModule {}
