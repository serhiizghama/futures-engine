import { IsString, IsUUID, IsIn, IsNumber, IsOptional, IsNotEmpty, Min, Max } from 'class-validator';

export class OpenPositionDto {
  @IsOptional()
  @IsUUID()
  positionId?: string;

  @IsUUID()
  @IsNotEmpty()
  userId: string;

  @IsString()
  @IsNotEmpty()
  symbol: string;

  @IsIn(['LONG', 'SHORT'])
  @IsNotEmpty()
  side: 'LONG' | 'SHORT';

  @IsNumber()
  @Min(1)
  @Max(125)
  leverage: number;

  @IsString()
  @IsNotEmpty()
  sizeContracts: string; // decimal as string to avoid precision loss

  @IsString()
  @IsNotEmpty()
  entryPrice: string; // decimal as string to avoid precision loss

  @IsOptional()
  @IsString()
  stopLossPrice?: string; // decimal as string to avoid precision loss

  @IsOptional()
  @IsString()
  takeProfitPrice?: string; // decimal as string to avoid precision loss
}
