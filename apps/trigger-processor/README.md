# trigger-processor (app)

Scaffold for consuming trigger commands, finalizing closes in PG, cleaning Redis triggers, and emitting close events.

## Config
- KAFKA_BROKERS
- REDIS_URL
- DATABASE_URL

## Responsibilities
- Consume `position.command.trigger.sl|tp|liq`
- In a DB transaction: lock position, compute PnL, mark CLOSED, write history
- Remove Redis ZSET entries for this position
- Emit `position.event.closed`

## Run Steps (pseudo)
1. Connect Kafka consumer/producer, PG client, Redis client
2. On trigger: begin tx → SELECT ... FOR UPDATE SKIP LOCKED
3. If already CLOSED → ack (idempotent)
4. Compute PnL using triggerPrice and side/size
5. UPDATE positions and INSERT history
6. ZREM from all `triggers:{symbol}:{side}:{type}` keys
7. Emit close event
