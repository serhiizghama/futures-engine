# position-api (app)

Scaffold for REST API emitting position commands and reading data from PG/Redis.

## Endpoints
- POST /positions → emit position.command.open (202)
- PATCH /positions/:id → emit position.command.update (202)
- DELETE /positions/:id → emit position.command.close (202)
- GET /positions/:id → read PG
- GET /positions?status=OPEN → read PG, MGET Redis current-price, compute live PnL

## Config
- KAFKA_BROKERS, REDIS_URL, DATABASE_URL, API_KEY (optional)
