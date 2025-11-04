import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { KafkaProducer } from '@futures-engine/kafka';

@Injectable()
export class KafkaProducerProvider implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(KafkaProducerProvider.name);
  private producer: KafkaProducer;

  constructor(private readonly configService: ConfigService) {
    const brokers = this.configService
      .get<string>('KAFKA_BROKERS', 'localhost:9092')
      .split(',');

    this.producer = new KafkaProducer({ brokers });
  }

  async onModuleInit() {
    await this.producer.connect();
    this.logger.log('Kafka Producer connected');
  }

  async onModuleDestroy() {
    await this.producer.disconnect();
    this.logger.log('Kafka Producer disconnected');
  }

  getProducer(): KafkaProducer {
    return this.producer;
  }
}
