import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateProductDto {
  @IsNotEmpty()
  barcode!: string;

  @IsOptional()
  @IsString()
  reference?: string;

  @IsOptional()
  @IsString()
  brand?: string;

  @IsOptional()
  @IsString()
  lineId?: string;

  @IsOptional()
  @IsString()
  subLineId?: string;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsString()
  subCategoryId?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  brandCode?: string;

  @IsOptional()
  @IsString()
  size?: string;

  @IsOptional()
  @IsString()
  color?: string;

  @IsOptional()
  @IsString()
  containerNumber?: string;

  @IsOptional()
  @IsString()
  billingNumber?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNotEmpty()
  cost!: string;

  @IsNotEmpty()
  priceRetail!: string;

  @IsNotEmpty()
  priceWholesale!: string;

  @IsIn(['ACTIVE', 'INACTIVE'])
  status!: string;
}
