import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { PositionsCommandService } from './positions.command.service';
import { PositionsQueryService } from './positions.query.service';
import { OpenPositionDto } from './dtos/open-position.dto';
import { UpdatePositionDto } from './dtos/update-position.dto';
import { ClosePositionDto } from './dtos/close-position.dto';
import { PositionDto } from './dtos/position.dto';

@Controller('positions')
export class PositionsController {
  private readonly logger = new Logger(PositionsController.name);

  constructor(
    private readonly commandService: PositionsCommandService,
    private readonly queryService: PositionsQueryService,
  ) {}

  /**
   * POST /positions
   * Opens a new position (emits command to Kafka, returns 202 Accepted)
   */
  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  async openPosition(@Body() dto: OpenPositionDto): Promise<{ requestId: string }> {
    this.logger.log(`Opening position for user ${dto.userId}, symbol ${dto.symbol}`);
    return await this.commandService.openPosition(dto);
  }

  /**
   * PATCH /positions/:id
   * Updates a position (emits command to Kafka, returns 202 Accepted)
   */
  @Patch(':id')
  @HttpCode(HttpStatus.ACCEPTED)
  async updatePosition(
    @Param('id') positionId: string,
    @Body() dto: UpdatePositionDto,
  ): Promise<{ requestId: string }> {
    this.logger.log(`Updating position ${positionId}`);
    return await this.commandService.updatePosition(positionId, dto);
  }

  /**
   * DELETE /positions/:id
   * Closes a position (emits command to Kafka, returns 202 Accepted)
   */
  @Delete(':id')
  @HttpCode(HttpStatus.ACCEPTED)
  async closePosition(
    @Param('id') positionId: string,
    @Body() dto?: ClosePositionDto,
  ): Promise<{ requestId: string }> {
    this.logger.log(`Closing position ${positionId}`);
    return await this.commandService.closePosition(positionId, dto);
  }

  /**
   * GET /positions/:id
   * Fetches a single position by ID from PostgreSQL
   */
  @Get(':id')
  async getPosition(@Param('id') positionId: string): Promise<PositionDto> {
    this.logger.log(`Fetching position ${positionId}`);
    return await this.queryService.getPosition(positionId);
  }

  /**
   * GET /positions?status=OPEN
   * Lists positions, optionally filtered by status
   * For OPEN positions, enriches with live PnL from Redis
   */
  @Get()
  async getPositions(
    @Query('status') status?: 'OPEN' | 'CLOSED',
  ): Promise<PositionDto[]> {
    this.logger.log(`Fetching positions with status: ${status || 'ALL'}`);
    return await this.queryService.getPositions(status);
  }
}
