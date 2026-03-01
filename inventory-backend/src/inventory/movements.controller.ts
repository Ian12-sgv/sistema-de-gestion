import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'SUPERVISOR', 'BODEGA', 'SUCURSAL')
@Controller('movements')
export class MovementsController {
  constructor(private svc: InventoryService) {}

  @Get()
  movements(
    @Query('warehouseId') warehouseId?: string,
    @Query('productId') productId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.svc.movements({ warehouseId, productId, from, to });
  }
}