/**
 * Redis key factory utilities
 */

export class KeyFactory {
  /**
   * Builds Redis key for current price cache
   * @param symbol - Symbol code (e.g., "BTCUSDT")
   * @returns Redis key string (e.g., "current-price:BTCUSDT")
   */
  static currentPrice(symbol: string): string {
    return `current-price:${symbol}`;
  }

  /**
   * Builds Redis key for trigger indices (ZSETs)
   * @param symbol - Symbol code
   * @param side - Position side ("long" | "short")
   * @param type - Trigger type ("sl" | "tp" | "liq")
   * @returns Redis key string (e.g., "triggers:BTCUSDT:long:sl")
   */
  static triggers(symbol: string, side: 'long' | 'short', type: 'sl' | 'tp' | 'liq'): string {
    return `triggers:${symbol}:${side}:${type}`;
  }
}
