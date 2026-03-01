import { Type } from 'class-transformer';
import { IsArray, IsNumber, IsOptional, IsUUID, Min, ValidateNested } from 'class-validator';

export class InventoryLineDto {
  @IsUUID()
  productId!: string;

  @IsNumber()
  @Min(0.001)
  qty!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  unitCost?: number;
}

export class UpsertLinesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InventoryLineDto)
  lines!: InventoryLineDto[];
}