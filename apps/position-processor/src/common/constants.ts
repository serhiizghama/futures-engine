// Kafka Topics
export const TOPICS = {
  COMMAND_OPEN: 'position.command.open',
  COMMAND_UPDATE: 'position.command.update',
  COMMAND_CLOSE: 'position.command.close',
  EVENT_OPENED: 'position.event.opened',
  EVENT_UPDATED: 'position.event.updated',
  EVENT_CLOSED: 'position.event.closed',
  DLQ: 'position.command.dlq',
} as const;

// Service configuration
export const SERVICE_NAME = 'position-processor';
export const CONSUMER_GROUP_ID = 'position-processor';
