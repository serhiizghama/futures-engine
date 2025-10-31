# Order Executor

External order execution service that communicates with Binance Trading API.

## Responsibilities

- Consume order commands from Kafka
- Execute orders on Binance (place, cancel, modify)
- Handle Binance API responses and errors
- Emit order execution events back to Kafka
- Manage API rate limits and connection stability

## Kafka Topics

**Consumes:**
- `order.command.create.market`
- `order.command.create.limit`
- `order.command.cancel`
- `order.command.modify`

**Produces:**
- `order.event.executed`
- `order.event.failed`
- `order.event.status.update`
