# position-processor (app)

Scaffold for consuming position commands, writing PG + Redis triggers, and emitting events.

## Config
- KAFKA_BROKERS
- REDIS_URL
- DATABASE_URL

## Responsibilities
- Consume position.command.open|update|close
- For open: write row to PG (OPEN), compute liquidation price, add ZSET triggers, emit opened
- For update: update SL/TP in PG and ZSETs, emit updated
- For close: mark CLOSED in PG, remove from ZSETs, emit closed

## Run Steps (pseudo)
1. Connect Kafka consumer/producer, PG client, Redis client
2. Handlers implement idempotency and validation
3. Use optimistic lock (updated_at) for updates
