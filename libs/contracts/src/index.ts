export type SymbolCode = string; // e.g., "BTCUSDT"
export type UUID = string;

export interface MarketTick {
  symbol: SymbolCode;
  price: string; // decimal as string to avoid JS precision loss
  ts: number; // epoch ms
}

export type PositionSide = 'LONG' | 'SHORT';

export interface PositionOpenCommand {
  positionId?: UUID;
  userId: UUID;
  symbol: SymbolCode;
  side: PositionSide;
  leverage: number;
  sizeContracts: string; // decimal as string to avoid JS precision loss
  entryPrice: string;
  stopLossPrice?: string;
  takeProfitPrice?: string;
}

export interface PositionUpdateCommand {
  positionId: UUID;
  stopLossPrice?: string;
  takeProfitPrice?: string;
}

export interface PositionCloseCommand {
  positionId: UUID;
  reason?: 'USER_CLOSE';
}

export type TriggerType = 'SL' | 'TP' | 'LIQ';

export interface TriggerCommand {
  positionId: UUID;
  symbol: SymbolCode;
  triggerType: TriggerType;
  triggerPrice: string;
  ts: number;
}

export interface PositionOpenedEvent {
  positionId: UUID;
  userId: UUID;
  symbol: SymbolCode;
  side: PositionSide;
  leverage: number;
  sizeContracts: string;
  entryPrice: string;
  stopLossPrice?: string;
  takeProfitPrice?: string;
  liquidationPrice: string;
  createdAt: string;
}

export interface PositionUpdatedEvent {
  positionId: UUID;
  stopLossPrice?: string;
  takeProfitPrice?: string;
  updatedAt: string;
}

export interface PositionClosedEvent {
  positionId: UUID;
  closePrice: string;
  closeReason: 'USER_CLOSE' | 'SL' | 'TP' | 'LIQUIDATION';
  pnl: string;
  closedAt: string;
}
