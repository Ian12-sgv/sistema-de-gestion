import { IsArray, ArrayNotEmpty, IsString } from 'class-validator';

export class SetRolesDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  roleCodes!: string[];
}