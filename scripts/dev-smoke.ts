/**
 * Smoke test script for shared libraries
 * Usage: npm run smoke
 *
 * Prerequisites:
 * - Kafka running on STANDARD port localhost:9092
 * - Redis running on STANDARD port localhost:6379
 * - PostgreSQL running on STANDARD port localhost:5432
 * - All configuration in .env file
 */

import * as dotenv from 'dotenv';
import { KafkaProducer, KafkaConsumer } from '../libs/kafka/src';
import { RedisClient, priceKey, triggersKey } from '../libs/redis/src';
import { PgClient } from '../libs/pg/src';
import { MarketTick } from '../libs/contracts/src';

// Load environment variables from .env file
dotenv.config();

async function main() {
  console.log('=== Shared Libraries Smoke Test ===\n');

  // ALWAYS use STANDARD ports - read from .env or use standard defaults
  const KAFKA_BROKERS = process.env.KAFKA_BROKERS?.split(',') || ['localhost:9092'];
  const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
  const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://futures:futures@localhost:5432/futures';

  console.log('Configuration:');
  console.log(`  Kafka: ${KAFKA_BROKERS.join(', ')}`);
  console.log(`  Redis: ${REDIS_URL}`);
  console.log(`  PostgreSQL: ${DATABASE_URL.replace(/:[^:@]+@/, ':***@')}\n`);

  // Test 1: Kafka Producer/Consumer
  console.log('--- Test 1: Kafka Producer/Consumer ---');
  const producer = new KafkaProducer({ brokers: KAFKA_BROKERS });
  const consumer = new KafkaConsumer({ brokers: KAFKA_BROKERS, groupId: 'smoke-test' });

  try {
    await producer.connect();
    await consumer.connect();

    const testTopic = 'test.smoke';
    const testMessage: MarketTick = {
      symbol: 'BTCUSDT',
      price: '50000.00',
      ts: Date.now(),
    };

    let messageReceived = false;
    const receivePromise = new Promise<void>((resolve) => {
      consumer.subscribe(testTopic, async (key, value) => {
        console.log(`  ✓ Consumed message: key=${key}, value=${JSON.stringify(value)}`);
        messageReceived = true;
        resolve();
      });
    });

    // Give consumer time to subscribe
    await new Promise(resolve => setTimeout(resolve, 2000));

    await producer.send(testTopic, 'BTCUSDT', testMessage);
    console.log('  ✓ Produced message to topic:', testTopic);

    // Wait for message or timeout
    await Promise.race([
      receivePromise,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Message not received within 10s')), 10000)
      )
    ]);

    console.log('  ✓ Kafka test passed\n');
  } catch (error) {
    console.error('  ✗ Kafka test failed:', error);
    throw error;
  } finally {
    await consumer.disconnect();
    await producer.disconnect();
  }

  // Test 2: Redis
  console.log('--- Test 2: Redis ---');
  const redis = new RedisClient({ url: REDIS_URL });

  try {
    await redis.connect();

    // Test price key
    const symbol = 'BTCUSDT';
    const price = '50000.00';
    await redis.set(priceKey(symbol), price, 60);
    console.log('  ✓ Set price key:', priceKey(symbol));

    const [retrievedPrice] = await redis.mget([priceKey(symbol)]);
    if (retrievedPrice === price) {
      console.log('  ✓ Retrieved price:', retrievedPrice);
    } else {
      throw new Error(`Price mismatch: expected ${price}, got ${retrievedPrice}`);
    }

    // Test ZSET operations for triggers
    const triggerKey = triggersKey(symbol, 'long', 'sl');
    const positionId = 'test-position-123';
    const stopLoss = 45000;

    await redis.zadd(triggerKey, stopLoss, positionId);
    console.log('  ✓ Added trigger to ZSET:', triggerKey);

    const triggers = await redis.zrevrangebyscore(triggerKey, stopLoss, 0);
    if (triggers.includes(positionId)) {
      console.log('  ✓ Retrieved trigger from ZSET:', triggers);
    } else {
      throw new Error(`Trigger not found in ZSET: ${triggers}`);
    }

    await redis.zrem(triggerKey, positionId);
    console.log('  ✓ Removed trigger from ZSET');

    console.log('  ✓ Redis test passed\n');
  } catch (error) {
    console.error('  ✗ Redis test failed:', error);
    throw error;
  } finally {
    await redis.disconnect();
  }

  // Test 3: PostgreSQL
  console.log('--- Test 3: PostgreSQL ---');
  const pg = new PgClient({ connectionString: DATABASE_URL });

  try {
    await pg.connect();
    console.log('  ✓ Connected to PostgreSQL');

    const healthResult = await pg.healthCheck();
    if (healthResult) {
      console.log('  ✓ Health check passed');
    } else {
      throw new Error('Health check failed');
    }

    // Query table list
    const result = await pg.query<{ tablename: string }>(
      "SELECT tablename FROM pg_tables WHERE schemaname = 'public'"
    );
    console.log('  ✓ Queried tables:', result.rows.map(r => r.tablename).join(', '));

    console.log('  ✓ PostgreSQL test passed\n');
  } catch (error) {
    console.error('  ✗ PostgreSQL test failed:', error);
    throw error;
  } finally {
    await pg.disconnect();
  }

  console.log('=== All Tests Passed ===');
}

main().catch((error) => {
  console.error('\n=== Smoke Test Failed ===');
  console.error(error);
  process.exit(1);
});
