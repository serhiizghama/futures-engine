import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { KafkaConsumerProvider } from './kafka/kafka.consumer.provider';
import { KafkaProducerProvider } from './kafka/kafka.producer.provider';
import { PgClientProvider } from './pg/pg.client.provider';
import { RedisClientProvider } from './redis/redis.client.provider';
import { ProcessorService } from './processor.service';

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
    PgClientProvider,
    RedisClientProvider,
    ProcessorService,
  ],
})
export class AppModule {}
