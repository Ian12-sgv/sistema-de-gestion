import { Body, Controller, Get, Param, Patch, Post, Put, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { SetRolesDto } from './dto/set-roles.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class UsersController {
  constructor(private svc: UsersService) {}

  // Perfil propio con contexto (nombres)
  @Roles('ADMIN', 'SUPERVISOR', 'BODEGA', 'SUCURSAL')
  @Get('me/profile')
  me(@CurrentUser() actor: AuthUser) {
    return this.svc.getMeProfile(actor.id);
  }

  @Roles('ADMIN', 'SUPERVISOR')
  @Get()
  list() {
    return this.svc.list();
  }

  @Roles('ADMIN', 'SUPERVISOR')
  @Get(':id')
  get(@Param('id') id: string) {
    return this.svc.get(id);
  }

  @Roles('ADMIN')
  @Post()
  create(@Body() dto: CreateUserDto) {
    return this.svc.create(dto);
  }

  @Roles('ADMIN')
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.svc.update(id, dto);
  }

  @Roles('ADMIN', 'SUPERVISOR', 'BODEGA', 'SUCURSAL')
  @Patch(':id/password')
  changePassword(
    @Param('id') id: string,
    @Body() dto: ChangePasswordDto,
    @CurrentUser() actor: AuthUser,
  ) {
    this.svc.assertSelfOrAdmin(actor, id);
    return this.svc.changePassword(id, dto);
  }

  @Roles('ADMIN')
  @Put(':id/roles')
  setRoles(@Param('id') id: string, @Body() dto: SetRolesDto) {
    return this.svc.setRoles(id, dto);
  }
}