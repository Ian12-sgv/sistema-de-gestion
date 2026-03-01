import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { StockService } from './stock.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('stock')
export class StockController {
  constructor(private svc: StockService) {}

  @Get()
  get(@Query('warehouseId') warehouseId?: string, @Query('productId') productId?: string) {
    return this.svc.getStock(warehouseId, productId);
  }
}