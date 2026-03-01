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

  // ✅ NUEVOS CAMPOS
  @IsOptional()
  @IsString()
  brandCode?: string; // Código de marca

  @IsOptional()
  @IsString()
  size?: string; // talla

  @IsOptional()
  @IsString()
  color?: string;

  @IsOptional()
  @IsString()
  containerNumber?: string; // numero de contenedor

  @IsOptional()
  @IsString()
  billingNumber?: string; // numero de facturacion

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsNotEmpty()
  cost!: string;

  @IsNotEmpty()
  priceRetail!: string;

  @IsNotEmpty()
  priceWholesale!: string;

  // ✅ Validación estricta
  @IsIn(['ACTIVE', 'INACTIVE'])
  status!: string;
}