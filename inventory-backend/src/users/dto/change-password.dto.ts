import { IsBoolean, IsNotEmpty, IsOptional, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @IsNotEmpty()
  @MinLength(6)
  newPassword!: string;

  @IsOptional()
  @IsBoolean()
  mustChangePassword?: boolean;
}