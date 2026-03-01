import { IsArray, IsBoolean, IsEmail, IsNotEmpty, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

export class CreateUserDto {
  @IsNotEmpty() @IsString()
  username!: string;

  @IsNotEmpty() @IsString()
  fullName!: string;

  @IsOptional() @IsEmail()
  email?: string;

  @IsOptional() @IsString()
  phone?: string;

  @IsNotEmpty() @MinLength(6)
  password!: string;

  @IsOptional() @IsBoolean()
  mustChangePassword?: boolean;

  @IsOptional() @IsBoolean()
  isActive?: boolean;

  @IsOptional() @IsUUID()
  defaultBranchId?: string;

  @IsOptional() @IsUUID()
  defaultWarehouseId?: string;

  // asignación inicial de roles por código (ADMIN, SUPERVISOR, BODEGA, SUCURSAL)
  @IsOptional() @IsArray()
  roleCodes?: string[];
}