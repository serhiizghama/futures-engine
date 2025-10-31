// Re-export contract types from libs/contracts
export {
  UUID,
  SymbolCode,
  PositionSide,
  PositionOpenCommand,
  PositionUpdateCommand,
  PositionCloseCommand,
  TriggerType,
  TriggerCommand,
  PositionOpenedEvent,
  PositionUpdatedEvent,
  PositionClosedEvent,
} from '@futures-engine/contracts';

// Database types
export interface PositionRow {
  position_id: string;
  user_id: string;
  symbol: string;
  status: 'OPEN' | 'CLOSED';
  side: 'LONG' | 'SHORT';
  leverage: number;
  size_contracts: string;
  entry_price: string;
  liquidation_price: string;
  stop_loss_price?: string;
  take_profit_price?: string;
  close_price?: string;
  pnl?: string;
  close_reason?: string;
  created_at: Date;
  updated_at: Date;
  closed_at?: Date;
}

export interface PositionHistoryRow {
  id: string;
  position_id: string;
  event_type: string;
  details: Record<string, unknown>;
  created_at: Date;
}
