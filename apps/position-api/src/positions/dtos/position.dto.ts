/**
 * Position DTO for API responses
 */
export class PositionDto {
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

  // Enriched fields for OPEN positions (from Redis)
  current_price?: string | null;
  live_pnl?: string | null;
  stale_price?: boolean;
}
