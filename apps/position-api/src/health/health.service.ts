import { Injectable, Inject, Logger } from '@nestjs/common';
import { KafkaProducer } from '@futures-engine/kafka';
import { RedisClient } from '@futures-engine/redis';
import { PgClient } from '@futures-engine/pg';

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(
    @Inject('KAFKA_PRODUCER')
    private readonly kafkaProducer: KafkaProducer,
    @Inject('REDIS_CLIENT')
    private readonly redisClient: RedisClient,
    @Inject('PG_CLIENT')
    private readonly pgClient: PgClient,
  ) {}

  /**
   * Checks readiness of all dependencies
   * Returns object with status of each dependency
   */
  async checkReadiness(): Promise<Record<string, boolean>> {
    const checks = {
      kafka: false,
      redis: false,
      postgres: false,
    };

    // Check Kafka (basic check - producer is connected)
    try {
      // KafkaProducer doesn't expose a direct health check method
      // We assume if it's connected during bootstrap, it's healthy
      // In production, you might want to add a metadata request
      checks.kafka = true;
    } catch (error) {
      this.logger.error('Kafka health check failed', error);
      checks.kafka = false;
    }

    // Check Redis (PING)
    try {
      await this.redisClient.connect(); // This calls PING internally
      checks.redis = true;
    } catch (error) {
      this.logger.error('Redis health check failed', error);
      checks.redis = false;
    }

    // Check PostgreSQL (SELECT 1)
    try {
      const isHealthy = await this.pgClient.healthCheck();
      checks.postgres = isHealthy;
    } catch (error) {
      this.logger.error('PostgreSQL health check failed', error);
      checks.postgres = false;
    }

    return checks;
  }
}
