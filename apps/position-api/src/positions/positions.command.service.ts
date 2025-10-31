import { Injectable, Inject, Logger } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { KafkaProducer } from '@futures-engine/kafka';
import {
  PositionOpenCommand,
  PositionUpdateCommand,
  PositionCloseCommand,
} from '@futures-engine/contracts';
import { OpenPositionDto } from './dtos/open-position.dto';
import { UpdatePositionDto } from './dtos/update-position.dto';
import { ClosePositionDto } from './dtos/close-position.dto';

@Injectable()
export class PositionsCommandService {
  private readonly logger = new Logger(PositionsCommandService.name);

  constructor(
    @Inject('KAFKA_PRODUCER')
    private readonly kafkaProducer: KafkaProducer,
  ) {}

  /**
   * Emits a position open command to Kafka
   * @returns Request ID for tracking
   */
  async openPosition(dto: OpenPositionDto): Promise<{ requestId: string }> {
    const requestId = dto.positionId || uuidv4();

    const command: PositionOpenCommand = {
      positionId: requestId,
      userId: dto.userId,
      symbol: dto.symbol,
      side: dto.side,
      leverage: dto.leverage,
      sizeContracts: dto.sizeContracts,
      entryPrice: dto.entryPrice,
      stopLossPrice: dto.stopLossPrice,
      takeProfitPrice: dto.takeProfitPrice,
    };

    try {
      await this.kafkaProducer.send(
        'position.command.open',
        dto.userId, // partition by userId
        command,
        { 'x-correlation-id': requestId },
      );

      this.logger.log(`Position open command sent: ${requestId}`);
      return { requestId };
    } catch (error) {
      this.logger.error(`Failed to send open command: ${requestId}`, error);
      throw error;
    }
  }

  /**
   * Emits a position update command to Kafka
   * @returns Request ID for tracking
   */
  async updatePosition(positionId: string, dto: UpdatePositionDto): Promise<{ requestId: string }> {
    const requestId = uuidv4();

    const command: PositionUpdateCommand = {
      positionId,
      stopLossPrice: dto.stopLossPrice,
      takeProfitPrice: dto.takeProfitPrice,
    };

    try {
      await this.kafkaProducer.send(
        'position.command.update',
        positionId, // partition by positionId
        command,
        { 'x-correlation-id': requestId },
      );

      this.logger.log(`Position update command sent: ${requestId} for position ${positionId}`);
      return { requestId };
    } catch (error) {
      this.logger.error(`Failed to send update command: ${requestId}`, error);
      throw error;
    }
  }

  /**
   * Emits a position close command to Kafka
   * @returns Request ID for tracking
   */
  async closePosition(positionId: string, dto?: ClosePositionDto): Promise<{ requestId: string }> {
    const requestId = uuidv4();

    const command: PositionCloseCommand = {
      positionId,
      reason: dto?.reason || 'USER_CLOSE',
    };

    try {
      await this.kafkaProducer.send(
        'position.command.close',
        positionId, // partition by positionId
        command,
        { 'x-correlation-id': requestId },
      );

      this.logger.log(`Position close command sent: ${requestId} for position ${positionId}`);
      return { requestId };
    } catch (error) {
      this.logger.error(`Failed to send close command: ${requestId}`, error);
      throw error;
    }
  }
}
