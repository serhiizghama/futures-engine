import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { KafkaConsumer } from '@futures-engine/kafka';
import { CONSUMER_GROUP_ID } from '../common/constants';

@Injectable()
export class KafkaConsumerProvider implements OnModuleInit, OnModuleDestroy {
  private consumer: KafkaConsumer;

  constructor(private readonly configService: ConfigService) {
    const brokers = this.configService.get<string>('KAFKA_BROKERS', 'localhost:9092').split(',');

    this.consumer = new KafkaConsumer({
      brokers,
      groupId: CONSUMER_GROUP_ID,
      clientId: CONSUMER_GROUP_ID,
    });
  }

  async onModuleInit() {
    await this.consumer.connect();
  }

  async onModuleDestroy() {
    await this.consumer.disconnect();
  }

  getConsumer(): KafkaConsumer {
    return this.consumer;
  }
}
