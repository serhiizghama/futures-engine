import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { KafkaProducer, KafkaHeaders } from '@futures-engine/kafka';

@Injectable()
export class KafkaProducerProvider implements OnModuleInit, OnModuleDestroy {
  private producer: KafkaProducer;

  constructor(private readonly configService: ConfigService) {
    const brokers = this.configService.get<string>('KAFKA_BROKERS', 'localhost:9092').split(',');

    this.producer = new KafkaProducer({
      brokers,
      clientId: 'position-processor-producer',
    });
  }

  async onModuleInit() {
    await this.producer.connect();
  }

  async onModuleDestroy() {
    await this.producer.disconnect();
  }

  async send(topic: string, key: string, value: unknown, headers?: KafkaHeaders): Promise<void> {
    await this.producer.send(topic, key, value, headers);
  }
}
