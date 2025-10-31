import { Pool, PoolClient, QueryResult } from 'pg';

export interface PgConfig { connectionString: string; }

export class PgClient {
  private pool: Pool;

  constructor(private readonly config: PgConfig) {
    this.pool = new Pool({
      connectionString: config.connectionString,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });

    this.pool.on('error', (err) => {
      console.error('[PgClient] Unexpected pool error:', err);
    });
  }

  async connect(): Promise<void> {
    try {
      // Test connection by running a simple query
      await this.pool.query('SELECT 1');
      console.log('[PgClient] Connection pool established');
    } catch (error) {
      console.error('[PgClient] Failed to establish connection:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    await this.pool.end();
    console.log('[PgClient] Connection pool closed');
  }

  async query<T = unknown>(sql: string, params?: unknown[]): Promise<{ rows: T[] }> {
    try {
      const result = await this.pool.query(sql, params);
      return { rows: result.rows as T[] };
    } catch (error) {
      console.error('[PgClient] Query error:', { sql, error });
      throw error;
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.pool.query('SELECT 1');
      return true;
    } catch (error) {
      console.error('[PgClient] Health check failed:', error);
      return false;
    }
  }
}
