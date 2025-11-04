export const CONSUMER_GROUP_ID = 'risk-engine-group';
export const DEFAULT_DEDUP_TTL_SECONDS = 300;

export const TOPICS = {
  MARKET_TICK: 'market.price.tick',
  POSITION_COMMAND_OPEN: 'position.command.open',
  POSITION_COMMAND_UPDATE: 'position.command.update',
  POSITION_COMMAND_CLOSE: 'position.command.close',
  TRIGGER_SL: 'position.command.trigger.sl',
  TRIGGER_TP: 'position.command.trigger.tp',
  TRIGGER_LIQ: 'position.command.trigger.liq',
  POSITION_EVENT_OPENED: 'position.event.opened',
  POSITION_EVENT_UPDATED: 'position.event.updated',
  POSITION_EVENT_CLOSED: 'position.event.closed',
} as const;


