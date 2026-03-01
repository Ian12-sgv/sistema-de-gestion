import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { WarehousesService } from './warehouses.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CreateWarehouseDto } from './dto/create-warehouse.dto';
import { UpdateWarehouseDto } from './dto/update-warehouse.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('warehouses')
export class WarehousesController {
  constructor(private svc: WarehousesService) {}

  /**
   * GET /warehouses?branchId=<uuid>&q=<texto>
   * - branchId es opcional
   * - q busca por name o code (case-insensitive)
   * - retorna también branch (id, code, name, type) -> puede ser null
   *
   * Acceso: ADMIN/SUPERVISOR/BODEGA/SUCURSAL (lectura para inventario)
   */
  @Roles('ADMIN', 'SUPERVISOR', 'BODEGA', 'SUCURSAL')
  @Get()
  list(@Query('branchId') branchId?: string, @Query('q') q?: string) {
    return this.svc.list({ branchId, q });
  }

  /**
   * GET /warehouses/:id
   * Acceso: ADMIN/SUPERVISOR/BODEGA/SUCURSAL (lectura)
   */
  @Roles('ADMIN', 'SUPERVISOR', 'BODEGA', 'SUCURSAL')
  @Get(':id')
  get(@Param('id') id: string) {
    return this.svc.get(id);
  }

  /**
   * POST /warehouses
   * Acceso: ADMIN/SUPERVISOR (escritura)
   */
  @Roles('ADMIN', 'SUPERVISOR')
  @Post()
  create(@Body() dto: CreateWarehouseDto) {
    return this.svc.create(dto);
  }

  /**
   * PATCH /warehouses/:id
   * Acceso: ADMIN/SUPERVISOR (escritura)
   */
  @Roles('ADMIN', 'SUPERVISOR')
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateWarehouseDto) {
    return this.svc.update(id, dto);
  }
}