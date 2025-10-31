import Decimal from 'decimal.js';

/**
 * Safe decimal PnL utilities using Decimal.js to avoid precision loss
 */

/**
 * Calculates live PnL for a position
 * @param side - Position side ("LONG" | "SHORT")
 * @param entryPrice - Entry price as string
 * @param currentPrice - Current market price as string
 * @param sizeContracts - Size in contracts as string
 * @returns PnL as string or null if currentPrice is missing
 */
export function calculateLivePnL(
  side: 'LONG' | 'SHORT',
  entryPrice: string,
  currentPrice: string | null,
  sizeContracts: string,
): string | null {
  if (!currentPrice) {
    return null;
  }

  try {
    const entry = new Decimal(entryPrice);
    const current = new Decimal(currentPrice);
    const size = new Decimal(sizeContracts);

    let pnl: Decimal;
    if (side === 'LONG') {
      // LONG: (currentPrice - entryPrice) * size
      pnl = current.minus(entry).times(size);
    } else {
      // SHORT: (entryPrice - currentPrice) * size
      pnl = entry.minus(current).times(size);
    }

    return pnl.toFixed(8); // Return as string with 8 decimal places
  } catch (error) {
    console.error('[PnL] Calculation error:', { side, entryPrice, currentPrice, sizeContracts, error });
    return null;
  }
}

/**
 * Converts string to Decimal safely
 * @param value - Numeric string
 * @returns Decimal instance or null on error
 */
export function toDecimal(value: string): Decimal | null {
  try {
    return new Decimal(value);
  } catch (error) {
    console.error('[PnL] Invalid decimal value:', value, error);
    return null;
  }
}
