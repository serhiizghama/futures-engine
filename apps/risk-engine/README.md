# risk-engine (app)

Scaffold for consuming ticks, querying Redis triggers, and emitting trigger commands.

## Config
- KAFKA_BROKERS
- REDIS_URL

## Responsibilities
- Consume `market.price.tick`
- Query Redis ZSETs per inequalities
- Emit `position.command.trigger.sl|tp|liq`

## Run Steps (pseudo)
1. Connect Kafka consumer (group per deployment)
2. On tick(symbol, price): run 6 Redis range queries
3. For each positionId matched: guard against duplicates; emit trigger command
4. Metrics and backpressure controls
