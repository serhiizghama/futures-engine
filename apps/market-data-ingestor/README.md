# market-data-ingestor (app)

Scaffold for ingesting Binance WS ticks, publishing to Kafka, and updating Redis current prices.

## Config
- KAFKA_BROKERS
- REDIS_URL
- SYMBOLS (CSV) e.g., BTCUSDT,ETHUSDT
- BINANCE_WS_URL (optional) default `wss://stream.binance.com:9443/stream`
- PRICE_TTL_SECONDS (default 60)

## Responsibilities
- Connect WS streams per symbol
- Normalize `{ symbol, price, ts }`
- Publish to `market.price.tick` (key=symbol)
- SET `current-price:{symbol}` = price EX TTL

## Run Steps (pseudo)
1. Read env/config
2. Connect Kafka producer and Redis client
3. Connect WS; on message → parse price → publish + Redis SET (parallel)
4. Handle reconnect/backoff; log metrics
