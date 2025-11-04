export { MarketTick, TriggerCommand } from '@futures-engine/contracts';

export type TriggerType = 'SL' | 'TP' | 'LIQ';
export type PositionSide = 'long' | 'short';

export interface TriggeredPosition {
  positionId: string;
  triggerType: TriggerType;
}
