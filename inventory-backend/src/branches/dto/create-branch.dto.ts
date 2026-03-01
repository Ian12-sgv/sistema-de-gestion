import { IsBoolean, IsIn, IsNotEmpty, IsOptional } from 'class-validator';

export class CreateBranchDto {
  @IsNotEmpty()
  code!: string;

  @IsNotEmpty()
  name!: string;

  @IsIn(['CENTRAL', 'BRANCH'])
  type!: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}