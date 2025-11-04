import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { KafkaConsumer } from '@futures-engine/kafka';
import { CONSUMER_GROUP_ID } from '../common/constants';

@Injectable()
export class KafkaConsumerProvider implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(KafkaConsumerProvider.name);
  private consumer: KafkaConsumer;

  constructor(private readonly configService: ConfigService) {
    const brokers = this.configService
      .get<string>('KAFKA_BROKERS', 'localhost:9092')
      .split(',');

    this.consumer = new KafkaConsumer({
      brokers,
      groupId: CONSUMER_GROUP_ID,
      clientId: CONSUMER_GROUP_ID,
    });
  }

  async onModuleInit() {
    await this.consumer.connect();
    this.logger.log('Kafka Consumer connected');
  }

  async onModuleDestroy() {
    await this.consumer.disconnect();
    this.logger.log('Kafka Consumer disconnected');
  }

  getConsumer(): KafkaConsumer {
    return this.consumer;
  }
}
