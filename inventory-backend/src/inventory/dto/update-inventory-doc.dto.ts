import { IsIn, IsOptional, IsUUID } from 'class-validator';

export class UpdateInventoryDocDto {
  @IsOptional()
  @IsIn(['INITIAL_LOAD', 'DISPATCH', 'RECEIVE', 'ADJUSTMENT', 'RETURN'])
  docType?: string;

  @IsOptional()
  @IsUUID()
  fromWarehouseId?: string | null;

  @IsOptional()
  @IsUUID()
  toWarehouseId?: string | null;

  @IsOptional()
  notes?: string | null;
}