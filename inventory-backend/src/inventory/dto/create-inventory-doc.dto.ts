import { IsIn, IsOptional, IsUUID } from 'class-validator';

export class CreateInventoryDocDto {
  @IsIn(['INITIAL_LOAD', 'DISPATCH', 'RECEIVE', 'ADJUSTMENT', 'RETURN'])
  docType!: string;

  @IsOptional() @IsUUID()
  fromWarehouseId?: string;

  @IsOptional() @IsUUID()
  toWarehouseId?: string;

  @IsOptional()
  notes?: string;
}