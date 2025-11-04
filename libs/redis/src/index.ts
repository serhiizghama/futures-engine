import Redis from 'ioredis';

export type RedisUrl = string;

export interface RedisClientConfig { url: RedisUrl; }

export class RedisClient {
  private client: Redis;

  constructor(private readonly config: RedisClientConfig) {
    this.client = new Redis(config.url, {
      connectTimeout: 10000,
      commandTimeout: 5000,
      retryStrategy(times) {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      maxRetriesPerRequest: 3,
    });

    this.client.on('connect', () => console.log('[RedisClient] Connected'));
    this.client.on('error', (err) => console.error('[RedisClient] Error:', err));
  }

  async connect(): Promise<void> {
    // ioredis connects automatically, but we can explicitly wait for ready
    await this.client.ping();
    console.log('[RedisClient] Connection verified');
  }

  async disconnect(): Promise<void> {
    await this.client.quit();
    console.log('[RedisClient] Disconnected');
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (ttlSeconds) {
      await this.client.set(key, value, 'EX', ttlSeconds);
    } else {
      await this.client.set(key, value);
    }
  }

  async setIfNotExists(key: string, value: string, ttlSeconds: number): Promise<boolean> {
    // SET key value EX seconds NX
    // Use ioredis command builder to call Redis SET with multiple options
    // Returns 'OK' if key was set, null if key already existed
    const result = await this.client.call('SET', key, value, 'EX', ttlSeconds, 'NX') as string | null;
    return result === 'OK';
  }

  async mget(keys: string[]): Promise<(string | null)[]> {
    if (keys.length === 0) return [];
    return await this.client.mget(...keys);
  }

  async zadd(key: string, score: number, member: string): Promise<void> {
    await this.client.zadd(key, score, member);
  }

  async zrem(key: string, member: string): Promise<void> {
    await this.client.zrem(key, member);
  }

  async zrangebyscore(key: string, min: number, max: number): Promise<string[]> {
    return await this.client.zrangebyscore(key, min, max);
  }

  async zrevrangebyscore(key: string, max: number, min: number): Promise<string[]> {
    return await this.client.zrevrangebyscore(key, max, min);
  }

  async sadd(key: string, member: string): Promise<void> {
    await this.client.sadd(key, member);
  }

  async sismember(key: string, member: string): Promise<boolean> {
    const result = await this.client.sismember(key, member);
    return result === 1;
  }

  async expire(key: string, seconds: number): Promise<void> {
    await this.client.expire(key, seconds);
  }

  async pipelineZRangeQueries(queries: Array<{
    key: string;
    method: 'zrangebyscore' | 'zrevrangebyscore';
    min: number;
    max: number;
  }>): Promise<string[][]> {
    const pipeline = this.client.pipeline();

    queries.forEach(({ key, method, min, max }) => {
      if (method === 'zrangebyscore') {
        pipeline.zrangebyscore(key, min, max);
      } else {
        // zrevrangebyscore takes (key, max, min) - note reversed order
        pipeline.zrevrangebyscore(key, max, min);
      }
    });

    const results = await pipeline.exec();

    if (!results) {
      throw new Error('Pipeline execution failed');
    }

    // results is array of [error, result] tuples
    return results.map(([err, res]) => {
      if (err) throw err;
      return res as string[];
    });
  }

  /**
   * Get the underlying ioredis client for advanced operations
   */
  getClient(): Redis {
    return this.client;
  }
}

export type SideKey = 'long' | 'short';
export type TriggerKey = 'sl' | 'tp' | 'liq';

export const priceKey = (symbol: string) => `current-price:${symbol}`;
export const triggersKey = (symbol: string, side: SideKey, type: TriggerKey) => `triggers:${symbol}:${side}:${type}`;
