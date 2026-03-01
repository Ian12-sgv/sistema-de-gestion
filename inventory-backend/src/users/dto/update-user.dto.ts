import { PartialType } from '@nestjs/mapped-types';
import { CreateUserDto } from './create-user.dto';
import { IsOptional, MinLength } from 'class-validator';

export class UpdateUserDto extends PartialType(CreateUserDto) {
  // Evitar actualizar password por aquí
  @IsOptional()
  @MinLength(9999) // hack simple para que nunca pase validación si lo mandan
  password?: string;
}