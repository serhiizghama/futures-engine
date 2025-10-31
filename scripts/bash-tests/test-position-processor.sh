#!/bin/bash

# Test script for position-processor service
# This script tests the position-processor by sending commands to Kafka and verifying the results

set -e

KAFKA_BROKERS="${KAFKA_BROKERS:-localhost:9092}"
REDIS_URL="${REDIS_URL:-redis://localhost:6379}"
DATABASE_URL="${DATABASE_URL:-postgresql://futures:futures@localhost:5432/futures}"

echo "=== Position Processor Test Script ==="
echo "Kafka Brokers: $KAFKA_BROKERS"
echo "Redis URL: $REDIS_URL"
echo "Database URL: $DATABASE_URL"
echo ""

# Check if required tools are installed
command -v docker >/dev/null 2>&1 || { echo "Error: docker is required but not installed."; exit 1; }
command -v psql >/dev/null 2>&1 || { echo "Warning: psql is not installed. Database verification will be skipped."; }

echo "Step 1: Verify Kafka topics exist"
docker exec -it kafka kafka-topics --bootstrap-server localhost:9092 --list | grep position.command || {
    echo "Creating Kafka topics..."
    docker exec -it kafka kafka-topics --bootstrap-server localhost:9092 --create --topic position.command.open --partitions 3 --replication-factor 1
    docker exec -it kafka kafka-topics --bootstrap-server localhost:9092 --create --topic position.command.update --partitions 3 --replication-factor 1
    docker exec -it kafka kafka-topics --bootstrap-server localhost:9092 --create --topic position.command.close --partitions 3 --replication-factor 1
    docker exec -it kafka kafka-topics --bootstrap-server localhost:9092 --create --topic position.event.opened --partitions 3 --replication-factor 1
    docker exec -it kafka kafka-topics --bootstrap-server localhost:9092 --create --topic position.event.updated --partitions 3 --replication-factor 1
    docker exec -it kafka kafka-topics --bootstrap-server localhost:9092 --create --topic position.event.closed --partitions 3 --replication-factor 1
}

echo ""
echo "Step 2: Send position.command.open to Kafka"
POSITION_ID="test-$(uuidgen | tr '[:upper:]' '[:lower:]')"
USER_ID="user-$(uuidgen | tr '[:upper:]' '[:lower:]')"

OPEN_COMMAND='{
  "positionId": "'$POSITION_ID'",
  "userId": "'$USER_ID'",
  "symbol": "BTCUSDT",
  "side": "LONG",
  "leverage": 10,
  "sizeContracts": "0.1",
  "entryPrice": "50000.00",
  "stopLossPrice": "49000.00",
  "takeProfitPrice": "52000.00"
}'

echo "Sending open command with position ID: $POSITION_ID"
echo "$OPEN_COMMAND" | docker exec -i kafka kafka-console-producer \
  --bootstrap-server localhost:9092 \
  --topic position.command.open \
  --property "key.separator=:" \
  --property "parse.key=true" <<< "$USER_ID:$OPEN_COMMAND"

echo ""
echo "Step 3: Wait for processing (5 seconds)..."
sleep 5

echo ""
echo "Step 4: Verify position in PostgreSQL"
if command -v psql >/dev/null 2>&1; then
    psql "$DATABASE_URL" -c "SELECT position_id, user_id, symbol, side, status, leverage, entry_price, liquidation_price, stop_loss_price, take_profit_price FROM positions WHERE position_id = '$POSITION_ID';"
else
    echo "psql not available, skipping database verification"
fi

echo ""
echo "Step 5: Verify Redis triggers"
docker exec -i redis redis-cli ZRANGE triggers:BTCUSDT:long:sl -inf +inf BYSCORE | grep "$POSITION_ID" && echo "✓ Stop Loss trigger found" || echo "✗ Stop Loss trigger not found"
docker exec -i redis redis-cli ZRANGE triggers:BTCUSDT:long:tp -inf +inf BYSCORE | grep "$POSITION_ID" && echo "✓ Take Profit trigger found" || echo "✗ Take Profit trigger not found"
docker exec -i redis redis-cli ZRANGE triggers:BTCUSDT:long:liq -inf +inf BYSCORE | grep "$POSITION_ID" && echo "✓ Liquidation trigger found" || echo "✗ Liquidation trigger not found"

echo ""
echo "Step 6: Send position.command.update to Kafka"
UPDATE_COMMAND='{
  "positionId": "'$POSITION_ID'",
  "stopLossPrice": "48500.00",
  "takeProfitPrice": "53000.00"
}'

echo "Sending update command..."
echo "$UPDATE_COMMAND" | docker exec -i kafka kafka-console-producer \
  --bootstrap-server localhost:9092 \
  --topic position.command.update \
  --property "key.separator=:" \
  --property "parse.key=true" <<< "$POSITION_ID:$UPDATE_COMMAND"

echo ""
echo "Step 7: Wait for processing (5 seconds)..."
sleep 5

echo ""
echo "Step 8: Verify updated position in PostgreSQL"
if command -v psql >/dev/null 2>&1; then
    psql "$DATABASE_URL" -c "SELECT position_id, stop_loss_price, take_profit_price, updated_at FROM positions WHERE position_id = '$POSITION_ID';"
else
    echo "psql not available, skipping database verification"
fi

echo ""
echo "Step 9: Send position.command.close to Kafka"
CLOSE_COMMAND='{
  "positionId": "'$POSITION_ID'",
  "reason": "USER_CLOSE"
}'

echo "Sending close command..."
echo "$CLOSE_COMMAND" | docker exec -i kafka kafka-console-producer \
  --bootstrap-server localhost:9092 \
  --topic position.command.close \
  --property "key.separator=:" \
  --property "parse.key=true" <<< "$POSITION_ID:$CLOSE_COMMAND"

echo ""
echo "Step 10: Wait for processing (5 seconds)..."
sleep 5

echo ""
echo "Step 11: Verify closed position in PostgreSQL"
if command -v psql >/dev/null 2>&1; then
    psql "$DATABASE_URL" -c "SELECT position_id, status, close_price, close_reason, pnl, closed_at FROM positions WHERE position_id = '$POSITION_ID';"
else
    echo "psql not available, skipping database verification"
fi

echo ""
echo "Step 12: Verify Redis triggers are removed"
docker exec -i redis redis-cli ZRANGE triggers:BTCUSDT:long:sl -inf +inf BYSCORE | grep "$POSITION_ID" && echo "✗ Stop Loss trigger still exists" || echo "✓ Stop Loss trigger removed"
docker exec -i redis redis-cli ZRANGE triggers:BTCUSDT:long:tp -inf +inf BYSCORE | grep "$POSITION_ID" && echo "✗ Take Profit trigger still exists" || echo "✓ Take Profit trigger removed"
docker exec -i redis redis-cli ZRANGE triggers:BTCUSDT:long:liq -inf +inf BYSCORE | grep "$POSITION_ID" && echo "✗ Liquidation trigger still exists" || echo "✓ Liquidation trigger removed"

echo ""
echo "=== Test Complete ==="
echo "Position ID: $POSITION_ID"
echo "Please check the logs of position-processor service for detailed information"
