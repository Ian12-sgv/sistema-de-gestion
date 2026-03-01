import { IsBoolean, IsNotEmpty, IsOptional, IsUUID } from 'class-validator';

export class CreateWarehouseDto {
  @IsOptional()
  @IsUUID()
  branchId?: string | null;

  @IsNotEmpty()
  code!: string;

  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}