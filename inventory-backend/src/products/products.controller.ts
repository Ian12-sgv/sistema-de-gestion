import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ProductsService } from './products.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('products')
export class ProductsController {
  constructor(private svc: ProductsService) {}

  @Roles('ADMIN', 'SUPERVISOR', 'BODEGA', 'SUCURSAL')
  @Get()
  list() {
    return this.svc.list();
  }

  @Roles('ADMIN', 'SUPERVISOR', 'BODEGA', 'SUCURSAL')
  @Get(':id')
  get(@Param('id') id: string) {
    return this.svc.get(id);
  }

  @Roles('ADMIN', 'SUPERVISOR')
  @Post()
  create(@Body() dto: CreateProductDto, @CurrentUser() user: AuthUser) {
    return this.svc.create(dto, user);
  }

  @Roles('ADMIN', 'SUPERVISOR')
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateProductDto, @CurrentUser() user: AuthUser) {
    return this.svc.update(id, dto, user);
  }

  @Roles('ADMIN', 'SUPERVISOR')
  @Delete(':id')
  deactivate(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.svc.deactivate(id, user);
  }

  @Roles('ADMIN', 'SUPERVISOR')
  @Get(':id/audit')
  audit(@Param('id') id: string) {
    return this.svc.audit(id);
  }
}