import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateTaxonomyItemDto {
  @IsNotEmpty()
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  lineId?: string;

  @IsOptional()
  @IsString()
  subLineId?: string;

  @IsOptional()
  @IsString()
  categoryId?: string;
}
