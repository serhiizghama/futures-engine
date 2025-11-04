import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { KafkaConsumerProvider } from './infrastructure/kafka.consumer.provider';
import { KafkaProducerProvider } from './infrastructure/kafka.producer.provider';
import { RedisClientProvider } from './infrastructure/redis.client.provider';
import { DeduplicationService } from './services/deduplication.service';
import { RiskService } from './services/risk.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
  ],
  providers: [
    KafkaConsumerProvider,
    KafkaProducerProvider,
    RedisClientProvider,
    DeduplicationService,
    RiskService,
  ],
})
export class AppModule {}
