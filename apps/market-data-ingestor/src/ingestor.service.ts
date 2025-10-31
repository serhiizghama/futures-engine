import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { KafkaProducer } from '@futures-engine/kafka';
import { RedisClient, priceKey } from '@futures-engine/redis';
import { MarketTick } from '@futures-engine/contracts';
import { BinanceClient, TickerData } from './binance.client';

@Injectable()
export class IngestorService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(IngestorService.name);
  private symbol!: string;
  private priceTtl!: number;
  private tickCount = 0;

  constructor(
    private readonly configService: ConfigService,
    private readonly kafkaProducer: KafkaProducer,
    private readonly redisClient: RedisClient,
    private readonly binanceClient: BinanceClient,
  ) {}

  async onModuleInit() {
    this.logger.log('Initializing market data ingestor...');

    // Load configuration
    const symbols = this.configService
      .get<string>('SYMBOLS', 'BTCUSDT')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);

    // Use first symbol only for MVP
    this.symbol = symbols[0];
    if (!this.symbol) {
      throw new Error('No symbols configured. Set SYMBOLS environment variable.');
    }

    this.priceTtl = this.configService.get<number>('PRICE_TTL_SECONDS', 60);

    this.logger.log(`Starting for symbol: ${this.symbol}`);
    this.logger.log(`Price TTL: ${this.priceTtl}s`);

    // Connect to Kafka and Redis
    this.logger.log('Connecting to Kafka and Redis...');
    await Promise.all([
      this.kafkaProducer.connect(),
      this.redisClient.connect(),
    ]);
    this.logger.log('Connected to Kafka and Redis');

    // Start Binance stream
    this.startBinanceStream();
  }

  async onModuleDestroy() {
    this.logger.log('Shutting down market data ingestor...');
    this.logger.log(`Total ticks processed: ${this.tickCount}`);

    // Close Binance stream
    this.binanceClient.close();

    // Disconnect from Kafka and Redis
    await Promise.all([
      this.kafkaProducer.disconnect(),
      this.redisClient.disconnect(),
    ]);

    this.logger.log('Shutdown complete');
  }

  private startBinanceStream() {
    this.binanceClient.subscribeTicker(
      this.symbol,
      (data) => this.handleTick(data),
      (error) => this.handleError(error),
    );
  }

  private async handleTick(data: TickerData) {
    try {
      const { symbol, price, eventTime } = data;

      // Build MarketTick message
      const tick: MarketTick = {
        symbol,
        price,
        ts: eventTime,
      };

      // Publish to Kafka and update Redis in parallel
      await Promise.all([
        this.kafkaProducer.send(
          'market.price.tick',
          symbol,
          tick,
          { 'content-type': 'application/json' },
        ),
        this.redisClient.set(priceKey(symbol), price, this.priceTtl),
      ]);

      this.tickCount++;

      // Log every 100 ticks
      if (this.tickCount % 100 === 0) {
        this.logger.log(
          `Processed ${this.tickCount} ticks for ${symbol}. Last price: ${price}`,
        );
      }
    } catch (error) {
      this.logger.error('Error processing tick', error);
      // Don't throw - continue processing other ticks
    }
  }

  private handleError(error: Error) {
    this.logger.error('Binance stream error', error);
    // In production, implement reconnection logic here
  }
}
