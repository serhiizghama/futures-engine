import { Injectable, Inject, Logger, NotFoundException } from '@nestjs/common';
import { PgClient } from '@futures-engine/pg';
import { RedisClient } from '@futures-engine/redis';
import { PositionDto } from './dtos/position.dto';
import { KeyFactory } from '../common/key-factory';
import { calculateLivePnL } from '../common/pnl.util';

interface PositionRow {
  position_id: string;
  user_id: string;
  symbol: string;
  status: 'OPEN' | 'CLOSED';
  side: 'LONG' | 'SHORT';
  leverage: number;
  size_contracts: string;
  entry_price: string;
  liquidation_price: string;
  stop_loss_price?: string | null;
  take_profit_price?: string | null;
  close_price?: string | null;
  pnl?: string | null;
  close_reason?: string | null;
  created_at: Date;
  updated_at: Date;
  closed_at?: Date | null;
}

@Injectable()
export class PositionsQueryService {
  private readonly logger = new Logger(PositionsQueryService.name);

  constructor(
    @Inject('PG_CLIENT')
    private readonly pgClient: PgClient,
    @Inject('REDIS_CLIENT')
    private readonly redisClient: RedisClient,
  ) {}

  /**
   * Fetches a single position by ID from PostgreSQL
   */
  async getPosition(positionId: string): Promise<PositionDto> {
    const { rows } = await this.pgClient.query<PositionRow>(
      'SELECT * FROM positions WHERE position_id = $1',
      [positionId],
    );

    if (rows.length === 0) {
      throw new NotFoundException(`Position with ID ${positionId} not found`);
    }

    return this.mapRowToDto(rows[0]);
  }

  /**
   * Fetches all positions, optionally filtered by status
   * For OPEN positions, enriches with live PnL from Redis
   */
  async getPositions(status?: 'OPEN' | 'CLOSED'): Promise<PositionDto[]> {
    let query = 'SELECT * FROM positions';
    const params: any[] = [];

    if (status) {
      query += ' WHERE status = $1';
      params.push(status);
    }

    query += ' ORDER BY created_at DESC';

    const { rows } = await this.pgClient.query<PositionRow>(query, params);

    if (rows.length === 0) {
      return [];
    }

    // If fetching OPEN positions, enrich with live PnL from Redis
    if (status === 'OPEN') {
      return await this.enrichWithLivePnL(rows);
    }

    return rows.map(row => this.mapRowToDto(row));
  }

  /**
   * Enriches OPEN positions with live PnL using Redis MGET
   */
  private async enrichWithLivePnL(rows: PositionRow[]): Promise<PositionDto[]> {
    try {
      // Extract unique symbols
      const symbols = Array.from(new Set(rows.map(r => r.symbol)));

      // Build Redis keys for current prices
      const priceKeys = symbols.map(s => KeyFactory.currentPrice(s));

      // Fetch all prices in one MGET call
      const prices = await this.redisClient.mget(priceKeys);

      // Build symbol -> price map
      const priceMap = new Map<string, string | null>();
      symbols.forEach((symbol, idx) => {
        priceMap.set(symbol, prices[idx]);
      });

      // Enrich each position with live PnL
      return rows.map(row => {
        const currentPrice = priceMap.get(row.symbol) || null;
        const livePnL = calculateLivePnL(
          row.side,
          row.entry_price,
          currentPrice,
          row.size_contracts,
        );

        return {
          ...this.mapRowToDto(row),
          current_price: currentPrice,
          live_pnl: livePnL,
          stale_price: currentPrice === null,
        };
      });
    } catch (error) {
      this.logger.error('Failed to enrich positions with live PnL', error);
      // On error, return positions without enrichment
      return rows.map(row => this.mapRowToDto(row));
    }
  }

  /**
   * Maps database row to DTO
   */
  private mapRowToDto(row: PositionRow): PositionDto {
    return {
      position_id: row.position_id,
      user_id: row.user_id,
      symbol: row.symbol,
      status: row.status,
      side: row.side,
      leverage: row.leverage,
      size_contracts: row.size_contracts,
      entry_price: row.entry_price,
      liquidation_price: row.liquidation_price,
      stop_loss_price: row.stop_loss_price,
      take_profit_price: row.take_profit_price,
      close_price: row.close_price,
      pnl: row.pnl,
      close_reason: row.close_reason,
      created_at: row.created_at,
      updated_at: row.updated_at,
      closed_at: row.closed_at,
    };
  }
}
