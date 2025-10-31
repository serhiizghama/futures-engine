import { Kafka, Producer, Consumer, logLevel } from 'kafkajs';

export interface KafkaHeaders { [key: string]: string; }

export interface KafkaProducerConfig {
  brokers: string[];
  clientId?: string;
}

export interface KafkaConsumerConfig {
  brokers: string[];
  groupId: string;
  clientId?: string;
}

export class KafkaProducer {
  private kafka: Kafka;
  private producer: Producer;

  constructor(private readonly config: KafkaProducerConfig) {
    this.kafka = new Kafka({
      clientId: config.clientId || 'futures-engine-producer',
      brokers: config.brokers,
      logLevel: logLevel.INFO,
      retry: {
        initialRetryTime: 300,
        retries: 8,
      },
    });
    this.producer = this.kafka.producer({
      allowAutoTopicCreation: true,
      idempotent: false, // at-least-once semantics
    });
  }

  async connect(): Promise<void> {
    await this.producer.connect();
    console.log('[KafkaProducer] Connected');
  }

  async disconnect(): Promise<void> {
    await this.producer.disconnect();
    console.log('[KafkaProducer] Disconnected');
  }

  async send(topic: string, key: string, value: unknown, headers?: KafkaHeaders): Promise<void> {
    try {
      const serializedValue = JSON.stringify(value);
      const messageHeaders: Record<string, string> = {
        'content-type': 'application/json',
        ...(headers || {}),
      };

      await this.producer.send({
        topic,
        messages: [{
          key,
          value: serializedValue,
          headers: messageHeaders,
        }],
      });
    } catch (error) {
      console.error('[KafkaProducer] Send error:', error);
      throw error;
    }
  }
}

export type MessageHandler = (key: string, value: unknown, headers?: KafkaHeaders) => Promise<void>;

export class KafkaConsumer {
  private kafka: Kafka;
  private consumer: Consumer;

  constructor(private readonly config: KafkaConsumerConfig) {
    this.kafka = new Kafka({
      clientId: config.clientId || 'futures-engine-consumer',
      brokers: config.brokers,
      logLevel: logLevel.INFO,
      retry: {
        initialRetryTime: 300,
        retries: 8,
      },
    });
    this.consumer = this.kafka.consumer({
      groupId: config.groupId,
      retry: {
        initialRetryTime: 300,
        retries: 5,
        multiplier: 2,
        maxRetryTime: 30000,
      },
    });
  }

  async connect(): Promise<void> {
    await this.consumer.connect();
    console.log('[KafkaConsumer] Connected');
  }

  async disconnect(): Promise<void> {
    await this.consumer.disconnect();
    console.log('[KafkaConsumer] Disconnected');
  }

  async subscribe(topic: string, handler: MessageHandler): Promise<void> {
    await this.consumer.subscribe({ topic, fromBeginning: false });
    console.log(`[KafkaConsumer] Subscribed to topic: ${topic}`);

    await this.consumer.run({
      autoCommit: true,
      eachMessage: async ({ topic, partition, message }) => {
        try {
          const key = message.key?.toString() || '';
          const rawValue = message.value?.toString() || '{}';
          const value = JSON.parse(rawValue);

          const headers: KafkaHeaders = {};
          if (message.headers) {
            for (const [key, value] of Object.entries(message.headers)) {
              headers[key] = value?.toString() || '';
            }
          }

          await handler(key, value, headers);
        } catch (error) {
          console.error('[KafkaConsumer] Handler error:', {
            topic,
            partition,
            offset: message.offset,
            error,
          });
          // Error logged, message will be retried by consumer retry config
          throw error;
        }
      },
    });
  }
}
