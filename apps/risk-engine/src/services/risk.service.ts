import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { KafkaConsumerProvider } from '../infrastructure/kafka.consumer.provider';
import { KafkaProducerProvider } from '../infrastructure/kafka.producer.provider';
import { RedisClientProvider } from '../infrastructure/redis.client.provider';
import { DeduplicationService } from './deduplication.service';
import { MarketTick, TriggerCommand, TriggeredPosition } from '../common/types';
import { triggersKey } from '@futures-engine/redis';
import { TOPICS } from 'src/common/constants';

@Injectable()
export class RiskService implements OnModuleInit {
  private readonly logger = new Logger(RiskService.name);

  constructor(
    private readonly consumerProvider: KafkaConsumerProvider,
    private readonly producerProvider: KafkaProducerProvider,
    private readonly redisProvider: RedisClientProvider,
    private readonly deduplicationService: DeduplicationService,
  ) { }

  async onModuleInit() {
    const consumer = this.consumerProvider.getConsumer();

    this.logger.log(`Subscribing to ${TOPICS.MARKET_TICK} topic`);

    await consumer.subscribe(TOPICS.MARKET_TICK, async (key, value) => {
      await this.handleTick(key, value);
    });

    this.logger.log('RiskService initialized and listening for ticks');
  }

  private async handleTick(key: string, value: unknown): Promise<void> {
    const startTime = Date.now();

    try {
      const tick = value as MarketTick;
      if (key && key !== tick.symbol) {
        this.logger.warn(`Tick key/symbol mismatch: key=${key}, symbol=${tick.symbol}`);
      }
      const { symbol, price: priceStr } = tick;
      const price = parseFloat(priceStr);

      if (isNaN(price)) {
        const errorMsg = `Invalid price in tick: ${priceStr} for ${symbol}`;
        this.logger.error(errorMsg);
        throw new Error(errorMsg);
      }

      this.logger.debug(`Processing tick: ${symbol} @ ${price}`);

      // Step 1: Query Redis ZSETs using pipelining
      const triggeredPositions = await this.queryTriggers(symbol, price);

      if (triggeredPositions.length === 0) {
        this.logger.debug(`No triggers for ${symbol} @ ${price}`);
        return;
      }

      this.logger.log(
        `Found ${triggeredPositions.length} triggered positions for ${symbol} @ ${price}`,
      );

      // Step 2: Check deduplication and build commands
      const commands: TriggerCommand[] = [];

      for (const { positionId, triggerType } of triggeredPositions) {
        const shouldEmit = await this.deduplicationService.shouldEmitTrigger(
          positionId,
          triggerType,
        );

        if (shouldEmit) {
          commands.push({
            positionId,
            symbol,
            triggerType,
            triggerPrice: priceStr,
            ts: Date.now(),
          });
        }
      }

      if (commands.length === 0) {
        this.logger.debug(
          `All triggers for ${symbol} @ ${price} were duplicates`,
        );
        return;
      }

      this.logger.log(
        `Emitting ${commands.length} trigger commands for ${symbol} @ ${price}`,
      );

      // Step 3: Send all commands to Kafka atomically
      // If any send fails, throw error to prevent commit
      await Promise.all(
        commands.map((cmd) => this.sendTriggerCommand(cmd)),
      );

      const elapsed = Date.now() - startTime;
      this.logger.debug(
        `Tick processing completed in ${elapsed}ms: ${symbol} @ ${price}`,
      );

      if (elapsed > 10) {
        this.logger.warn(
          `Tick processing exceeded 10ms target: ${elapsed}ms for ${symbol} @ ${price}`,
        );
      }
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `Error handling tick: ${err.message}`,
        err.stack,
      );
      // Re-throw to prevent Kafka commit
      throw error;
    }
  }

  private async queryTriggers(
    symbol: string,
    price: number,
  ): Promise<TriggeredPosition[]> {
    const redis = this.redisProvider.getClient();

    // Build queries for pipelining
    const queries = [
      // LONG positions
      {
        key: triggersKey(symbol, 'long', 'sl'),
        method: 'zrevrangebyscore' as const,
        min: -Infinity,
        max: price,
      },
      {
        key: triggersKey(symbol, 'long', 'tp'),
        method: 'zrangebyscore' as const,
        min: -Infinity,
        max: price,
      },
      {
        key: triggersKey(symbol, 'long', 'liq'),
        method: 'zrevrangebyscore' as const,
        min: -Infinity,
        max: price,
      },
      // SHORT positions
      {
        key: triggersKey(symbol, 'short', 'sl'),
        method: 'zrangebyscore' as const,
        min: price,
        max: Infinity,
      },
      {
        key: triggersKey(symbol, 'short', 'tp'),
        method: 'zrevrangebyscore' as const,
        min: -Infinity,
        max: price,
      },
      {
        key: triggersKey(symbol, 'short', 'liq'),
        method: 'zrangebyscore' as const,
        min: price,
        max: Infinity,
      },
    ];

    // Execute all queries in a single pipeline
    const [longSl, longTp, longLiq, shortSl, shortTp, shortLiq] =
      await redis.pipelineZRangeQueries(queries);

    // Build array of triggered positions
    const triggered: TriggeredPosition[] = [];

    for (const positionId of longSl) {
      triggered.push({ positionId, triggerType: 'SL' });
    }
    for (const positionId of longTp) {
      triggered.push({ positionId, triggerType: 'TP' });
    }
    for (const positionId of longLiq) {
      triggered.push({ positionId, triggerType: 'LIQ' });
    }
    for (const positionId of shortSl) {
      triggered.push({ positionId, triggerType: 'SL' });
    }
    for (const positionId of shortTp) {
      triggered.push({ positionId, triggerType: 'TP' });
    }
    for (const positionId of shortLiq) {
      triggered.push({ positionId, triggerType: 'LIQ' });
    }

    return triggered;
  }

  private async sendTriggerCommand(command: TriggerCommand): Promise<void> {
    const producer = this.producerProvider.getProducer();
    const topic = this.getTriggerTopic(command.triggerType);

    await producer.send(topic, command.positionId, command, {
      'content-type': 'application/json',
    });

    this.logger.debug(
      `Sent ${command.triggerType} trigger for position ${command.positionId}`,
    );
  }

  private getTriggerTopic(triggerType: string): string {
    switch (triggerType) {
      case 'SL':
        return TOPICS.TRIGGER_SL;
      case 'TP':
        return TOPICS.TRIGGER_TP;
      case 'LIQ':
        return TOPICS.TRIGGER_LIQ;
      default:
        throw new Error(`Unknown trigger type: ${triggerType}`);
    }
  }
}
