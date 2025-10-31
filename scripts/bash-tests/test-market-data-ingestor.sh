#!/bin/bash
# Test script for market-data-ingestor service

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "========================================="
echo "Market Data Ingestor - Test Script"
echo "========================================="
echo ""

# Load environment variables
if [ -f "$PROJECT_ROOT/.env" ]; then
    echo "✓ Loading environment from .env"
    source "$PROJECT_ROOT/.env"
else
    echo "✗ .env file not found, using defaults"
    export KAFKA_BROKERS="localhost:9092"
    export REDIS_URL="redis://localhost:6379"
    export SYMBOLS="BTCUSDT"
fi

echo ""
echo "Configuration:"
echo "  KAFKA_BROKERS: $KAFKA_BROKERS"
echo "  REDIS_URL: $REDIS_URL"
echo "  SYMBOLS: $SYMBOLS"
echo ""

# Step 1: Check infrastructure
echo "Step 1: Checking infrastructure..."
echo "-----------------------------------"

# Check Redis
if redis-cli ping > /dev/null 2>&1; then
    echo "✓ Redis is running"
else
    echo "✗ Redis is NOT running. Please start it with: docker compose up -d"
    exit 1
fi

# Check Kafka (basic connection test)
if docker ps | grep -q futures-kafka; then
    echo "✓ Kafka is running"
else
    echo "✗ Kafka is NOT running. Please start it with: docker compose up -d"
    exit 1
fi

echo ""

# Step 2: Clear old data
echo "Step 2: Clearing old test data..."
echo "-----------------------------------"
redis-cli DEL "current-price:$SYMBOLS" > /dev/null 2>&1 || true
echo "✓ Redis key cleared"
echo ""

# Step 3: Start the service in background
echo "Step 3: Starting market-data-ingestor..."
echo "-----------------------------------"
cd "$PROJECT_ROOT/../apps/market-data-ingestor"

# Kill any existing processes
pkill -f "market-data-ingestor" > /dev/null 2>&1 || true
sleep 2

# Start service in background
KAFKA_BROKERS="$KAFKA_BROKERS" \
REDIS_URL="$REDIS_URL" \
SYMBOLS="$SYMBOLS" \
npm run dev > /tmp/market-data-ingestor.log 2>&1 &

SERVICE_PID=$!
echo "✓ Service started (PID: $SERVICE_PID)"
echo "  Log file: /tmp/market-data-ingestor.log"
echo ""

# Step 4: Wait for service to connect
echo "Step 4: Waiting for service to initialize..."
echo "-----------------------------------"
sleep 8
echo "✓ Service should be connected now"
echo ""

# Step 5: Verify Redis updates
echo "Step 5: Verifying Redis updates..."
echo "-----------------------------------"
sleep 5

PRICE=$(redis-cli GET "current-price:$SYMBOLS")
TTL=$(redis-cli TTL "current-price:$SYMBOLS")

if [ -n "$PRICE" ] && [ "$PRICE" != "(nil)" ]; then
    echo "✓ Redis key exists!"
    echo "  Key: current-price:$SYMBOLS"
    echo "  Price: $PRICE"
    echo "  TTL: ${TTL}s"
else
    echo "✗ Redis key NOT found. Check logs at /tmp/market-data-ingestor.log"
    echo ""
    echo "Last 20 lines of log:"
    tail -20 /tmp/market-data-ingestor.log
    kill $SERVICE_PID 2>/dev/null || true
    exit 1
fi

echo ""

# Step 6: Show service logs
echo "Step 6: Recent service logs..."
echo "-----------------------------------"
tail -15 /tmp/market-data-ingestor.log
echo ""

# Step 7: Summary
echo "========================================="
echo "Test Summary"
echo "========================================="
echo "✓ Service is running and ingesting data"
echo "✓ Redis is being updated with fresh prices"
echo ""
echo "Service PID: $SERVICE_PID"
echo "To stop: kill $SERVICE_PID"
echo "To view logs: tail -f /tmp/market-data-ingestor.log"
echo ""
echo "Press Ctrl+C to stop the service or let it run..."

# Keep script running
wait $SERVICE_PID
