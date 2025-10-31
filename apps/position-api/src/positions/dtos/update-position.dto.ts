import { IsString, IsOptional } from 'class-validator';

export class UpdatePositionDto {
  @IsOptional()
  @IsString()
  stopLossPrice?: string; // decimal as string to avoid precision loss

  @IsOptional()
  @IsString()
  takeProfitPrice?: string; // decimal as string to avoid precision loss
}
