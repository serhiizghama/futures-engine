import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisClientProvider } from '../infrastructure/redis.client.provider';
import { TriggerType } from '../common/types';
import { DEFAULT_DEDUP_TTL_SECONDS } from '../common/constants';

@Injectable()
export class DeduplicationService {
  private readonly logger = new Logger(DeduplicationService.name);
  private readonly dedupTtlSeconds: number;

  constructor(
    private readonly redisProvider: RedisClientProvider,
    private readonly configService: ConfigService,
  ) {
    this.dedupTtlSeconds = this.configService.get<number>(
      'DEDUP_TTL_SECONDS',
      DEFAULT_DEDUP_TTL_SECONDS,
    );
    this.logger.log(`Deduplication TTL: ${this.dedupTtlSeconds} seconds`);
  }

  async shouldEmitTrigger(
    positionId: string,
    triggerType: TriggerType,
  ): Promise<boolean> {
    const key = this.getDedupKey(positionId, triggerType);
    const redis = this.redisProvider.getClient();

    try {
      const wasSet = await redis.setIfNotExists(key, '1', this.dedupTtlSeconds);

      if (!wasSet) {
        // Key already existed - this is a duplicate
        this.logger.debug(
          `Duplicate trigger detected: ${positionId} ${triggerType}`,
        );
        return false;
      }

      // Key was set - this is a new trigger, should be emitted
      return true;
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `Deduplication check failed for ${positionId} ${triggerType}: ${err.message}`,
      );
      // On error, allow the trigger to proceed (fail open)
      // The trigger-processor is idempotent, so duplicates are safe
      return true;
    }
  }

  private getDedupKey(positionId: string, triggerType: TriggerType): string {
    return `processed:triggers:${positionId}:${triggerType}`;
  }
}
