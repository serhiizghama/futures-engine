import { IsIn, IsOptional } from 'class-validator';

export class ClosePositionDto {
  @IsOptional()
  @IsIn(['USER_CLOSE'])
  reason?: 'USER_CLOSE';
}
