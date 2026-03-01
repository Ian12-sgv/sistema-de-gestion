import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { CreateInventoryDocDto } from './dto/create-inventory-doc.dto';
import { UpsertLinesDto } from './dto/upsert-lines.dto';
import { UpdateInventoryDocDto } from './dto/update-inventory-doc.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'SUPERVISOR', 'BODEGA', 'SUCURSAL')
@Controller('inventory-docs')
export class InventoryDocsController {
  constructor(private svc: InventoryService) {}

  @Get()
  list(
    @Query('status') status?: string,
    @Query('docType') docType?: string,
    @Query('warehouseId') warehouseId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.svc.listDocs({ status, docType, warehouseId, from, to });
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.svc.getDoc(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateInventoryDocDto) {
    return this.svc.updateDraftDoc(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.svc.deleteDraftDoc(id);
  }

  @Post()
  create(@Body() dto: CreateInventoryDocDto, @CurrentUser() user: AuthUser) {
    return this.svc.createDraft(dto, user);
  }

  // ✅ “bulk replace” (recomendado para tu UI)
  @Put(':id/lines')
  replaceLines(@Param('id') id: string, @Body() dto: UpsertLinesDto) {
    return this.svc.upsertLines(id, dto);
  }

  // alias por compatibilidad si quieres seguir usando POST
  @Post(':id/lines')
  upsertLines(@Param('id') id: string, @Body() dto: UpsertLinesDto) {
    return this.svc.upsertLines(id, dto);
  }

  @Get(':id/lines')
  lines(@Param('id') id: string) {
    return this.svc.getDocLines(id);
  }

  @Post(':id/post')
  postDoc(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.svc.postDoc(id, user);
  }
}