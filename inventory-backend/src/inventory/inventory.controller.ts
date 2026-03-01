import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser} from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { CreateInventoryDocDto } from './dto/create-inventory-doc.dto';
import { UpsertLinesDto } from './dto/upsert-lines.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'SUPERVISOR', 'BODEGA', 'SUCURSAL')
@Controller('inventory')
export class InventoryController {
  constructor(private svc: InventoryService) {}

  @Post('docs')
  createDoc(@Body() dto: CreateInventoryDocDto, @CurrentUser() user: AuthUser) {
    return this.svc.createDraft(dto, user);
  }

  @Post('docs/:id/lines')
  upsertLines(@Param('id') id: string, @Body() dto: UpsertLinesDto) {
    return this.svc.upsertLines(id, dto);
  }

  @Post('docs/:id/post')
  postDoc(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.svc.postDoc(id, user);
  }

  @Get('movements')
  movements(
    @Query('warehouseId') warehouseId?: string,
    @Query('productId') productId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.svc.movements({ warehouseId, productId, from, to });
  }
}