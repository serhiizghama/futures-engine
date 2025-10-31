import { Injectable, Logger } from '@nestjs/common';
import { WebsocketClient } from 'binance';

export interface TickerData {
  symbol: string;
  price: string;
  eventTime: number;
}

@Injectable()
export class BinanceClient {
  private readonly logger = new Logger(BinanceClient.name);
  private wsClient: WebsocketClient;

  constructor() {
    // Initialize Binance WebSocket client (no auth needed for public streams)
    this.wsClient = new WebsocketClient({
      beautify: true,
    });

    // Set up event listeners
    this.wsClient.on('error', (err) => {
      this.logger.error('WebSocket client error', err);
    });

    this.wsClient.on('open', (data) => {
      this.logger.debug('WebSocket connection opened', data);
    });

    this.wsClient.on('close', () => {
      this.logger.debug('WebSocket connection closed');
    });
  }

  /**
   * Subscribe to ticker stream for a given symbol
   * @param symbol - Trading symbol (e.g., 'BTCUSDT')
   * @param onMessage - Callback for each ticker update
   * @param onError - Callback for errors
   */
  subscribeTicker(
    symbol: string,
    onMessage: (data: TickerData) => void,
    onError: (error: Error) => void
  ): void {
    this.logger.log(`Subscribing to ticker stream for ${symbol}`);

    try {
      // Subscribe to 24hr ticker stream using the SDK method
      this.wsClient.subscribeSpotSymbol24hrTicker(symbol);

      // Listen for raw message events (the SDK sends raw Binance format)
      this.wsClient.on('message', (data: any) => {
        try {
          // Filter for ticker messages for our symbol
          if (data.e === '24hrTicker' && data.s === symbol) {
            const tickerData: TickerData = {
              symbol: data.s,
              price: data.c, // Close price (last/current price)
              eventTime: data.E,
            };
            // this.logger.log('Ticker data received', tickerData);
            onMessage(tickerData);
          }
        } catch (err) {
          this.logger.error('Error processing ticker message', err);
          onError(err instanceof Error ? err : new Error(String(err)));
        }
      });

      this.logger.log(`Successfully subscribed to ticker for ${symbol}`);
    } catch (err) {
      this.logger.error('Error subscribing to ticker stream', err);
      onError(err instanceof Error ? err : new Error(String(err)));
    }
  }

  /**
   * Close the WebSocket connection
   */
  close(): void {
    this.logger.log('Closing Binance WebSocket connection');
    try {
      this.wsClient.closeAll();
    } catch (err) {
      this.logger.error('Error closing WebSocket', err);
    }
  }
}
