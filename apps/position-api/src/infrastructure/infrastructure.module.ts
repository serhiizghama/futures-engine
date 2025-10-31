import { Module, Global } from '@nestjs/common';
import { KafkaProducer } from '@futures-engine/kafka';
import { RedisClient } from '@futures-engine/redis';
import { PgClient } from '@futures-engine/pg';

@Global()
@Module({
  providers: [
    {
      provide: 'KAFKA_PRODUCER',
      useFactory: () => {
        const brokers = process.env.KAFKA_BROKERS?.split(',') || ['localhost:9092'];
        const clientId = process.env.SERVICE_NAME || 'position-api';
        return new KafkaProducer({ brokers, clientId });
      },
    },
    {
      provide: 'REDIS_CLIENT',
      useFactory: () => {
        const url = process.env.REDIS_URL || 'redis://localhost:6379';
        return new RedisClient({ url });
      },
    },
    {
      provide: 'PG_CLIENT',
      useFactory: () => {
        const connectionString =
          process.env.DATABASE_URL ||
          `postgresql://${process.env.PGUSER || 'futures'}:${process.env.PGPASSWORD || 'futures'}@${process.env.PGHOST || 'localhost'}:${process.env.PGPORT || '5432'}/${process.env.PGDATABASE || 'futures'}`;
        return new PgClient({ connectionString });
      },
    },
  ],
  exports: ['KAFKA_PRODUCER', 'REDIS_CLIENT', 'PG_CLIENT'],
})
export class InfrastructureModule {}
