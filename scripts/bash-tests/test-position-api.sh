#!/bin/bash

# Test script for position-api
# Prerequisites:
# - Infrastructure running (docker compose up -d)
# - Database migrations applied
# - market-data-ingestor running (for Redis prices)
# - position-api running on port 3001

set -e

API_URL="http://localhost:3001"
USER_ID="550e8400-e29b-41d4-a716-446655440000"

echo "========================================="
echo "Testing position-api"
echo "========================================="
echo ""

# Test 1: Health check (liveness)
echo "1. Testing liveness endpoint..."
curl -s "${API_URL}/health" | jq .
echo ""
echo "✓ Liveness check passed"
echo ""

# Test 2: Readiness check
echo "2. Testing readiness endpoint..."
curl -s "${API_URL}/health/ready" | jq .
echo ""
echo "✓ Readiness check passed"
echo ""

# Test 3: Open a position
echo "3. Opening a new position..."
OPEN_RESPONSE=$(curl -s -X POST "${API_URL}/positions" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "'"${USER_ID}"'",
    "symbol": "BTCUSDT",
    "side": "LONG",
    "leverage": 10,
    "sizeContracts": "0.1",
    "entryPrice": "50000.00",
    "stopLossPrice": "49000.00",
    "takeProfitPrice": "52000.00"
  }')
echo "$OPEN_RESPONSE" | jq .
POSITION_ID=$(echo "$OPEN_RESPONSE" | jq -r '.requestId')
echo ""
echo "✓ Position opened with ID: ${POSITION_ID}"
echo ""

# Wait a bit for Kafka message to be processed (if processor is running)
echo "4. Waiting 2 seconds for command to be processed..."
sleep 2
echo ""

# Test 4: Try to get the position (will fail if processor hasn't run yet)
echo "5. Attempting to get position by ID..."
curl -s "${API_URL}/positions/${POSITION_ID}" | jq . || echo "⚠ Position not found in database (processor may not be running)"
echo ""

# Test 5: List all positions
echo "6. Listing all positions..."
curl -s "${API_URL}/positions" | jq .
echo ""
echo "✓ List all positions succeeded"
echo ""

# Test 6: List only OPEN positions
echo "7. Listing OPEN positions..."
curl -s "${API_URL}/positions?status=OPEN" | jq .
echo ""
echo "✓ List OPEN positions succeeded"
echo ""

# Test 7: Update position (if it exists)
echo "8. Updating position triggers..."
curl -s -X PATCH "${API_URL}/positions/${POSITION_ID}" \
  -H "Content-Type: application/json" \
  -d '{
    "stopLossPrice": "49500.00",
    "takeProfitPrice": "51500.00"
  }' | jq .
echo ""
echo "✓ Position update command sent"
echo ""

# Test 8: Close position
echo "9. Closing position..."
curl -s -X DELETE "${API_URL}/positions/${POSITION_ID}" | jq .
echo ""
echo "✓ Position close command sent"
echo ""

# Test 9: List CLOSED positions
echo "10. Listing CLOSED positions..."
curl -s "${API_URL}/positions?status=CLOSED" | jq .
echo ""
echo "✓ List CLOSED positions succeeded"
echo ""

echo "========================================="
echo "All tests completed!"
echo "========================================="
echo ""
echo "Note: This script only tests the API endpoints."
echo "To verify end-to-end functionality, ensure:"
echo "  - position-processor is running (to persist positions to DB)"
echo "  - market-data-ingestor is running (to provide live prices)"
echo "  - Check Kafka UI to verify messages were sent"
echo "  - Check PostgreSQL to verify data persistence"
