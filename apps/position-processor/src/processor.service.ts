import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { KafkaConsumerProvider } from './kafka/kafka.consumer.provider';
import { KafkaProducerProvider } from './kafka/kafka.producer.provider';
import { PgClientProvider } from './pg/pg.client.provider';
import { RedisClientProvider } from './redis/redis.client.provider';
import { TOPICS } from './common/constants';
import { v4 as uuidv4 } from 'uuid';
import Decimal from 'decimal.js';
import { priceKey, triggersKey } from '@futures-engine/redis';
import {
  PositionOpenCommand,
  PositionUpdateCommand,
  PositionCloseCommand,
  PositionOpenedEvent,
  PositionUpdatedEvent,
  PositionClosedEvent,
  PositionRow,
} from './common/types';

@Injectable()
export class ProcessorService implements OnModuleInit {
  private readonly logger = new Logger(ProcessorService.name);

  constructor(
    private readonly kafkaConsumer: KafkaConsumerProvider,
    private readonly kafkaProducer: KafkaProducerProvider,
    private readonly pgClient: PgClientProvider,
    private readonly redisClient: RedisClientProvider,
  ) {}

  async onModuleInit() {
    const consumer = this.kafkaConsumer.getConsumer();

    // Subscribe to command topics
    await consumer.subscribe(TOPICS.COMMAND_OPEN, this.handleOpen.bind(this));
    await consumer.subscribe(TOPICS.COMMAND_UPDATE, this.handleUpdate.bind(this));
    await consumer.subscribe(TOPICS.COMMAND_CLOSE, this.handleClose.bind(this));

    this.logger.log('ProcessorService initialized and subscribed to command topics');
  }

  /**
   * Handle position.command.open
   */
  private async handleOpen(key: string, value: unknown, headers?: Record<string, string>): Promise<void> {
    try {
      const cmd = value as PositionOpenCommand;
      const correlationId = headers?.['correlation-id'] || uuidv4();

      this.logger.log(`[${correlationId}] Handling OPEN command for user ${cmd.userId}, symbol ${cmd.symbol}`);

      // Generate position ID if not provided
      const positionId = cmd.positionId || uuidv4();

      // Compute liquidation price
      const liquidationPrice = this.computeLiquidationPrice(
        cmd.entryPrice,
        cmd.side,
        cmd.leverage,
      );

      // Insert position into PostgreSQL
      const pg = this.pgClient.getClient();
      const insertSql = `
        INSERT INTO positions (
          position_id, user_id, symbol, status, side, leverage,
          size_contracts, entry_price, liquidation_price,
          stop_loss_price, take_profit_price, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
        ON CONFLICT (position_id) DO NOTHING
        RETURNING *
      `;

      const result = await pg.query<PositionRow>(insertSql, [
        positionId,
        cmd.userId,
        cmd.symbol,
        'OPEN',
        cmd.side,
        cmd.leverage,
        cmd.sizeContracts,
        cmd.entryPrice,
        liquidationPrice,
        cmd.stopLossPrice || null,
        cmd.takeProfitPrice || null,
      ]);

      // Check if row was inserted (idempotency check)
      if (result.rows.length === 0) {
        this.logger.warn(`[${correlationId}] Position ${positionId} already exists, skipping`);
        return;
      }

      const position = result.rows[0];

      // Insert history entry
      await this.insertHistory(positionId, 'OPENED', {
        userId: cmd.userId,
        symbol: cmd.symbol,
        side: cmd.side,
        leverage: cmd.leverage,
        sizeContracts: cmd.sizeContracts,
        entryPrice: cmd.entryPrice,
      });

      // Add Redis ZSET triggers
      await this.addRedisTriggersForOpen(
        positionId,
        cmd.symbol,
        cmd.side,
        liquidationPrice,
        cmd.stopLossPrice,
        cmd.takeProfitPrice,
      );

      // Emit position.event.opened
      const event: PositionOpenedEvent = {
        positionId,
        userId: cmd.userId,
        symbol: cmd.symbol,
        side: cmd.side,
        leverage: cmd.leverage,
        sizeContracts: cmd.sizeContracts,
        entryPrice: cmd.entryPrice,
        stopLossPrice: cmd.stopLossPrice,
        takeProfitPrice: cmd.takeProfitPrice,
        liquidationPrice,
        createdAt: position.created_at.toISOString(),
      };

      await this.kafkaProducer.send(TOPICS.EVENT_OPENED, positionId, event, {
        'correlation-id': correlationId,
      });

      this.logger.log(`[${correlationId}] Position ${positionId} opened successfully`);
    } catch (error) {
      this.logger.error(`Error handling OPEN command: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Handle position.command.update
   */
  private async handleUpdate(key: string, value: unknown, headers?: Record<string, string>): Promise<void> {
    try {
      const cmd = value as PositionUpdateCommand;
      const correlationId = headers?.['correlation-id'] || uuidv4();

      this.logger.log(`[${correlationId}] Handling UPDATE command for position ${cmd.positionId}`);

      const pg = this.pgClient.getClient();

      // Fetch current position
      const selectSql = `SELECT * FROM positions WHERE position_id = $1 AND status = 'OPEN'`;
      const selectResult = await pg.query<PositionRow>(selectSql, [cmd.positionId]);

      if (selectResult.rows.length === 0) {
        this.logger.warn(`[${correlationId}] Position ${cmd.positionId} not found or not OPEN, skipping`);
        return;
      }

      const currentPosition = selectResult.rows[0];

      // Update SL/TP in PostgreSQL
      const updateSql = `
        UPDATE positions
        SET stop_loss_price = $2, take_profit_price = $3, updated_at = NOW()
        WHERE position_id = $1 AND status = 'OPEN'
        RETURNING *
      `;

      const updateResult = await pg.query<PositionRow>(updateSql, [
        cmd.positionId,
        cmd.stopLossPrice || null,
        cmd.takeProfitPrice || null,
      ]);

      if (updateResult.rows.length === 0) {
        this.logger.warn(`[${correlationId}] Position ${cmd.positionId} update failed, position may have been closed`);
        return;
      }

      const updatedPosition = updateResult.rows[0];

      // Insert history entry
      await this.insertHistory(cmd.positionId, 'UPDATED', {
        stopLossPrice: cmd.stopLossPrice,
        takeProfitPrice: cmd.takeProfitPrice,
      });

      // Update Redis ZSET triggers
      await this.updateRedisTriggersForUpdate(
        cmd.positionId,
        currentPosition.symbol,
        currentPosition.side,
        currentPosition.liquidation_price,
        currentPosition.stop_loss_price,
        currentPosition.take_profit_price,
        cmd.stopLossPrice,
        cmd.takeProfitPrice,
      );

      // Emit position.event.updated
      const event: PositionUpdatedEvent = {
        positionId: cmd.positionId,
        stopLossPrice: cmd.stopLossPrice,
        takeProfitPrice: cmd.takeProfitPrice,
        updatedAt: updatedPosition.updated_at.toISOString(),
      };

      await this.kafkaProducer.send(TOPICS.EVENT_UPDATED, cmd.positionId, event, {
        'correlation-id': correlationId,
      });

      this.logger.log(`[${correlationId}] Position ${cmd.positionId} updated successfully`);
    } catch (error) {
      this.logger.error(`Error handling UPDATE command: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Handle position.command.close
   */
  private async handleClose(key: string, value: unknown, headers?: Record<string, string>): Promise<void> {
    try {
      const cmd = value as PositionCloseCommand;
      const correlationId = headers?.['correlation-id'] || uuidv4();

      this.logger.log(`[${correlationId}] Handling CLOSE command for position ${cmd.positionId}`);

      const pg = this.pgClient.getClient();
      const redis = this.redisClient.getClient();

      // Fetch current position
      const selectSql = `SELECT * FROM positions WHERE position_id = $1 AND status = 'OPEN'`;
      const selectResult = await pg.query<PositionRow>(selectSql, [cmd.positionId]);

      if (selectResult.rows.length === 0) {
        this.logger.warn(`[${correlationId}] Position ${cmd.positionId} not found or already closed, skipping`);
        return;
      }

      const position = selectResult.rows[0];

      // Get current price from Redis for close price
      const currentPriceKey = priceKey(position.symbol);
      const currentPriceValues = await redis.mget([currentPriceKey]);
      const closePrice = currentPriceValues[0] || position.entry_price;

      // Compute PnL
      const pnl = this.computePnl(
        position.side,
        position.size_contracts,
        position.entry_price,
        closePrice,
      );

      // Update position to CLOSED in PostgreSQL
      const updateSql = `
        UPDATE positions
        SET status = 'CLOSED',
            close_price = $2,
            close_reason = $3,
            pnl = $4,
            closed_at = NOW(),
            updated_at = NOW()
        WHERE position_id = $1 AND status = 'OPEN'
        RETURNING *
      `;

      const updateResult = await pg.query<PositionRow>(updateSql, [
        cmd.positionId,
        closePrice,
        cmd.reason || 'USER_CLOSE',
        pnl,
      ]);

      if (updateResult.rows.length === 0) {
        this.logger.warn(`[${correlationId}] Position ${cmd.positionId} close failed, position may have been closed already`);
        return;
      }

      const closedPosition = updateResult.rows[0];

      // Insert history entry
      await this.insertHistory(cmd.positionId, 'CLOSED', {
        closePrice,
        closeReason: cmd.reason || 'USER_CLOSE',
        pnl,
      });

      // Remove Redis ZSET triggers
      await this.removeRedisTriggersForClose(
        cmd.positionId,
        position.symbol,
        position.side,
      );

      // Emit position.event.closed
      const event: PositionClosedEvent = {
        positionId: cmd.positionId,
        closePrice,
        closeReason: (cmd.reason || 'USER_CLOSE') as 'USER_CLOSE' | 'SL' | 'TP' | 'LIQUIDATION',
        pnl,
        closedAt: closedPosition.closed_at!.toISOString(),
      };

      await this.kafkaProducer.send(TOPICS.EVENT_CLOSED, cmd.positionId, event, {
        'correlation-id': correlationId,
      });

      this.logger.log(`[${correlationId}] Position ${cmd.positionId} closed successfully with PnL: ${pnl}`);
    } catch (error) {
      this.logger.error(`Error handling CLOSE command: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Compute liquidation price
   * Simplified formula:
   * - LONG: liquidationPrice = entryPrice * (1 - 0.9 / leverage)
   * - SHORT: liquidationPrice = entryPrice * (1 + 0.9 / leverage)
   */
  private computeLiquidationPrice(entryPrice: string, side: 'LONG' | 'SHORT', leverage: number): string {
    const entry = new Decimal(entryPrice);
    const lev = new Decimal(leverage);
    const factor = new Decimal(0.9).div(lev);

    if (side === 'LONG') {
      return entry.mul(new Decimal(1).minus(factor)).toFixed(2);
    } else {
      return entry.mul(new Decimal(1).plus(factor)).toFixed(2);
    }
  }

  /**
   * Compute PnL
   * - LONG: pnl = sizeContracts * (closePrice - entryPrice)
   * - SHORT: pnl = sizeContracts * (entryPrice - closePrice)
   */
  private computePnl(side: 'LONG' | 'SHORT', sizeContracts: string, entryPrice: string, closePrice: string): string {
    const size = new Decimal(sizeContracts);
    const entry = new Decimal(entryPrice);
    const close = new Decimal(closePrice);

    if (side === 'LONG') {
      return size.mul(close.minus(entry)).toFixed(2);
    } else {
      return size.mul(entry.minus(close)).toFixed(2);
    }
  }

  /**
   * Add Redis triggers for opened position
   */
  private async addRedisTriggersForOpen(
    positionId: string,
    symbol: string,
    side: 'LONG' | 'SHORT',
    liquidationPrice: string,
    stopLossPrice?: string,
    takeProfitPrice?: string,
  ): Promise<void> {
    const redis = this.redisClient.getClient();
    const sideKey = side.toLowerCase() as 'long' | 'short';

    // Add liquidation trigger
    const liqKey = triggersKey(symbol, sideKey, 'liq');
    await redis.zadd(liqKey, parseFloat(liquidationPrice), positionId);

    // Add stop loss trigger if provided
    if (stopLossPrice) {
      const slKey = triggersKey(symbol, sideKey, 'sl');
      await redis.zadd(slKey, parseFloat(stopLossPrice), positionId);
    }

    // Add take profit trigger if provided
    if (takeProfitPrice) {
      const tpKey = triggersKey(symbol, sideKey, 'tp');
      await redis.zadd(tpKey, parseFloat(takeProfitPrice), positionId);
    }

    this.logger.debug(`Added Redis triggers for position ${positionId}`);
  }

  /**
   * Update Redis triggers for updated position
   */
  private async updateRedisTriggersForUpdate(
    positionId: string,
    symbol: string,
    side: 'LONG' | 'SHORT',
    liquidationPrice: string,
    oldStopLossPrice?: string,
    oldTakeProfitPrice?: string,
    newStopLossPrice?: string,
    newTakeProfitPrice?: string,
  ): Promise<void> {
    const redis = this.redisClient.getClient();
    const sideKey = side.toLowerCase() as 'long' | 'short';

    // Update stop loss trigger
    const slKey = triggersKey(symbol, sideKey, 'sl');
    if (oldStopLossPrice && !newStopLossPrice) {
      // Remove SL
      await redis.zrem(slKey, positionId);
    } else if (newStopLossPrice && oldStopLossPrice !== newStopLossPrice) {
      // Update SL (remove old, add new)
      await redis.zrem(slKey, positionId);
      await redis.zadd(slKey, parseFloat(newStopLossPrice), positionId);
    } else if (newStopLossPrice && !oldStopLossPrice) {
      // Add new SL
      await redis.zadd(slKey, parseFloat(newStopLossPrice), positionId);
    }

    // Update take profit trigger
    const tpKey = triggersKey(symbol, sideKey, 'tp');
    if (oldTakeProfitPrice && !newTakeProfitPrice) {
      // Remove TP
      await redis.zrem(tpKey, positionId);
    } else if (newTakeProfitPrice && oldTakeProfitPrice !== newTakeProfitPrice) {
      // Update TP (remove old, add new)
      await redis.zrem(tpKey, positionId);
      await redis.zadd(tpKey, parseFloat(newTakeProfitPrice), positionId);
    } else if (newTakeProfitPrice && !oldTakeProfitPrice) {
      // Add new TP
      await redis.zadd(tpKey, parseFloat(newTakeProfitPrice), positionId);
    }

    this.logger.debug(`Updated Redis triggers for position ${positionId}`);
  }

  /**
   * Remove Redis triggers for closed position
   */
  private async removeRedisTriggersForClose(
    positionId: string,
    symbol: string,
    side: 'LONG' | 'SHORT',
  ): Promise<void> {
    const redis = this.redisClient.getClient();
    const sideKey = side.toLowerCase() as 'long' | 'short';

    // Remove all triggers for this position
    const liqKey = triggersKey(symbol, sideKey, 'liq');
    const slKey = triggersKey(symbol, sideKey, 'sl');
    const tpKey = triggersKey(symbol, sideKey, 'tp');

    await Promise.all([
      redis.zrem(liqKey, positionId),
      redis.zrem(slKey, positionId),
      redis.zrem(tpKey, positionId),
    ]);

    this.logger.debug(`Removed Redis triggers for position ${positionId}`);
  }

  /**
   * Insert position history entry
   */
  private async insertHistory(positionId: string, eventType: string, details: Record<string, unknown>): Promise<void> {
    const pg = this.pgClient.getClient();
    const sql = `
      INSERT INTO position_history (id, position_id, event_type, details, created_at)
      VALUES ($1, $2, $3, $4, NOW())
    `;

    await pg.query(sql, [uuidv4(), positionId, eventType, JSON.stringify(details)]);
  }
}
