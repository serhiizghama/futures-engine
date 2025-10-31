import { Module } from '@nestjs/common';
import { PositionsController } from './positions.controller';
import { PositionsCommandService } from './positions.command.service';
import { PositionsQueryService } from './positions.query.service';

@Module({
  controllers: [PositionsController],
  providers: [PositionsCommandService, PositionsQueryService],
})
export class PositionsModule {}
