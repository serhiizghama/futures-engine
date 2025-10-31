# position-api

NestJS REST API for managing crypto futures positions. This service emits position commands to Kafka (no direct DB writes) and serves read-only queries from PostgreSQL, enriched with live PnL data from Redis.

## Architecture

This service follows CQRS principles:
- **Commands**: Emitted to Kafka topics for async processing by downstream services
- **Queries**: Served directly from PostgreSQL, with live PnL enrichment from Redis

## Endpoints

### Command Endpoints (202 Accepted)

- **POST /positions** - Open a new position
  - Emits `position.command.open` to Kafka
  - Returns `{ requestId: string }`

- **PATCH /positions/:id** - Update position triggers (SL/TP)
  - Emits `position.command.update` to Kafka
  - Returns `{ requestId: string }`

- **DELETE /positions/:id** - Close a position
  - Emits `position.command.close` to Kafka
  - Returns `{ requestId: string }`

### Query Endpoints

- **GET /positions/:id** - Get single position by ID
  - Returns position from PostgreSQL

- **GET /positions?status=OPEN** - List positions
  - Supports optional `status` filter (`OPEN` | `CLOSED`)
  - For OPEN positions, enriches with live PnL from Redis using MGET
  - Returns array of positions with `current_price`, `live_pnl`, and `stale_price` fields

### Health Endpoints

- **GET /health** - Liveness probe (always returns 200 OK)
- **GET /health/ready** - Readiness probe (checks Kafka, Redis, PostgreSQL)

## Environment Variables

| Variable | Description | Default | Example |
|----------|-------------|---------|---------|
| `PORT` | HTTP port | `3001` | `3001` |
| `KAFKA_BROKERS` | Kafka broker list (comma-separated) | `localhost:9092` | `kafka:9093` |
| `REDIS_URL` | Redis connection URL | `redis://localhost:6379` | `redis://redis:6379` |
| `PGHOST` | PostgreSQL host | `localhost` | `postgres` |
| `PGPORT` | PostgreSQL port | `5432` | `5432` |
| `PGUSER` | PostgreSQL user | `futures` | `futures` |
| `PGPASSWORD` | PostgreSQL password | `futures` | `futures` |
| `PGDATABASE` | PostgreSQL database | `futures` | `futures` |
| `DATABASE_URL` | Full PostgreSQL connection string (optional) | - | `postgresql://user:pass@host:5432/db` |
| `SERVICE_NAME` | Service name for Kafka client ID | `position-api` | `position-api` |

## Development

### Prerequisites

- Node.js 20+
- Running infrastructure (Kafka, Redis, PostgreSQL)
- Shared libraries installed (`libs/kafka`, `libs/redis`, `libs/pg`, `libs/contracts`)

### Install Dependencies

```bash
npm install
```

### Run Locally

```bash
# From project root
npm run start --workspace apps/position-api

# Or with environment variables
PORT=3001 \
KAFKA_BROKERS=localhost:9092 \
REDIS_URL=redis://localhost:6379 \
PGHOST=localhost \
PGPORT=5432 \
PGUSER=futures \
PGPASSWORD=futures \
PGDATABASE=futures \
npm run start --workspace apps/position-api
```

### Build

```bash
npm run build --workspace apps/position-api
```

### Production

```bash
npm run start:prod --workspace apps/position-api
```

## Docker

### Production Build

The service uses a multi-stage Dockerfile for optimized production builds:

```bash
# Build production image
docker compose build position-api

# Start all services (production)
docker compose up -d

# Start only position-api and its dependencies
docker compose up -d position-api

# View logs
docker compose logs -f position-api

# Rebuild after code changes
docker compose up -d --build position-api
```

### Development Mode

For local development with hot reload, use the dev profile:

```bash
# Start in development mode (installs deps on container startup)
docker compose --profile dev up position-api-dev

# This will:
# - Mount your local code into the container
# - Run npm ci to install dependencies
# - Start the service in watch mode
```

**Note:** The dev mode (`position-api-dev`) runs `npm ci` on every container start, which can be slow. For faster development, run the service locally outside Docker.

## API Examples

### Open Position

```bash
curl -X POST http://localhost:3001/positions \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "550e8400-e29b-41d4-a716-446655440000",
    "symbol": "BTCUSDT",
    "side": "LONG",
    "leverage": 10,
    "sizeContracts": "0.1",
    "entryPrice": "50000.00",
    "stopLossPrice": "49000.00",
    "takeProfitPrice": "52000.00"
  }'
```

Response:
```json
{
  "requestId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

### Update Position

```bash
curl -X PATCH http://localhost:3001/positions/{positionId} \
  -H "Content-Type: application/json" \
  -d '{
    "stopLossPrice": "49500.00",
    "takeProfitPrice": "51500.00"
  }'
```

### Close Position

```bash
curl -X DELETE http://localhost:3001/positions/{positionId}
```

### Get Position

```bash
curl http://localhost:3001/positions/{positionId}
```

### List Open Positions

```bash
curl http://localhost:3001/positions?status=OPEN
```

Response includes live PnL enrichment:
```json
[
  {
    "position_id": "...",
    "user_id": "...",
    "symbol": "BTCUSDT",
    "side": "LONG",
    "entry_price": "50000.00",
    "size_contracts": "0.1",
    "current_price": "50500.00",
    "live_pnl": "50.00000000",
    "stale_price": false,
    ...
  }
]
```

## Key Implementation Details

1. **No DB Writes**: This service only emits commands to Kafka. Actual database writes happen in downstream processors.

2. **Live PnL Calculation**: For OPEN positions, the service fetches current prices from Redis and computes PnL in-memory using Decimal.js for precision.

3. **Stale Price Handling**: If Redis price is missing (TTL expired), `live_pnl` is null and `stale_price` is true.

4. **Validation**: Global ValidationPipe ensures strict DTO validation with class-validator.

5. **Graceful Shutdown**: NestJS lifecycle hooks ensure clean disconnection from Kafka, Redis, and PostgreSQL.

## Topics & Message Format

See `libs/contracts` for full message schemas and `docs/topics.md` for detailed topic specifications.

### Emitted Topics

All Kafka messages are sent with JSON-serialized payloads and include headers for tracing.

#### `position.command.open`
- **Purpose**: Open a new position
- **Partition Key**: `userId` (ensures all commands for a user go to the same partition)
- **Payload**: `PositionOpenCommand` from `@futures-engine/contracts`
- **Headers**:
  - `content-type: application/json`
  - `x-correlation-id: <requestId>` (for distributed tracing)

**Example message:**
```json
{
  "key": "550e8400-e29b-41d4-a716-446655440000",
  "value": {
    "positionId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "userId": "550e8400-e29b-41d4-a716-446655440000",
    "symbol": "BTCUSDT",
    "side": "LONG",
    "leverage": 10,
    "sizeContracts": "0.1",
    "entryPrice": "50000.00",
    "stopLossPrice": "49000.00",
    "takeProfitPrice": "52000.00"
  },
  "headers": {
    "content-type": "application/json",
    "x-correlation-id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
  }
}
```

#### `position.command.update`
- **Purpose**: Update position triggers (stop-loss, take-profit)
- **Partition Key**: `positionId` (ensures ordered updates for same position)
- **Payload**: `PositionUpdateCommand` from `@futures-engine/contracts`
- **Headers**:
  - `content-type: application/json`
  - `x-correlation-id: <requestId>`

**Example message:**
```json
{
  "key": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "value": {
    "positionId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "stopLossPrice": "49500.00",
    "takeProfitPrice": "51500.00"
  },
  "headers": {
    "content-type": "application/json",
    "x-correlation-id": "b2c3d4e5-f6a7-8901-bcde-f1234567890a"
  }
}
```

#### `position.command.close`
- **Purpose**: Close a position (user-initiated)
- **Partition Key**: `positionId` (ensures ordered operations for same position)
- **Payload**: `PositionCloseCommand` from `@futures-engine/contracts`
- **Headers**:
  - `content-type: application/json`
  - `x-correlation-id: <requestId>`

**Example message:**
```json
{
  "key": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "value": {
    "positionId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "reason": "USER_CLOSE"
  },
  "headers": {
    "content-type": "application/json",
    "x-correlation-id": "c3d4e5f6-a7b8-9012-cdef-1234567890ab"
  }
}
```

### Partitioning Strategy

**Why we partition by `userId` for open commands:**
- Ensures all position creations for a user are processed in order
- Allows downstream processors to maintain per-user state consistency
- Enables parallel processing across different users

**Why we partition by `positionId` for update/close commands:**
- Ensures all operations on the same position are strictly ordered
- Prevents race conditions when updating/closing positions
- Maintains consistency for trigger updates

### Correlation IDs

All emitted messages include an `x-correlation-id` header that:
- Uniquely identifies the request flow through the system
- Can be used for distributed tracing and debugging
- Matches the `requestId` returned in the HTTP response
- Allows linking API requests to downstream processing events

## Testing

### Manual Testing

1. Start infrastructure: `docker compose up -d kafka redis postgres`
2. Apply migrations: `./scripts/db-apply.sh`
3. Start market-data-ingestor to populate Redis prices
4. Start position-api
5. Use curl commands above or Postman to test endpoints
6. Verify Kafka messages in Kafka UI (http://localhost:8080 if configured)
7. Query PostgreSQL directly to see persisted positions (after processor runs)

### Health Check

```bash
# Liveness
curl http://localhost:3001/health

# Readiness
curl http://localhost:3001/health/ready
```

## Troubleshooting

### Service won't start

- Check that Kafka, Redis, and PostgreSQL are running and accessible
- Verify environment variables are set correctly
- Check logs for connection errors

### Commands not being processed

- Ensure downstream processors (position-processor) are running
- Check Kafka topics exist and are accessible
- Verify Kafka UI shows messages on expected topics

### Live PnL always null

- Ensure market-data-ingestor is running and publishing prices to Redis
- Check Redis has `current-price:{symbol}` keys with valid TTL
- Verify symbol in position matches symbol in Redis

## Related Services

- **market-data-ingestor**: Publishes current prices to Redis
- **position-processor**: Consumes open/update commands, writes to PostgreSQL
- **trigger-processor**: Consumes trigger commands, closes positions
- **risk-engine**: Monitors prices and emits trigger commands

## License

Proprietary
