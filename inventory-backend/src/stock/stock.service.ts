import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class StockService {
  constructor(private prisma: PrismaService) {}

  getStock(warehouseId?: string, productId?: string) {
    return this.prisma.stockBalance.findMany({
      where: {
        ...(warehouseId ? { warehouseId } : {}),
        ...(productId ? { productId } : {}),
      },
      include: { product: true, warehouse: true },
      orderBy: { updatedAt: 'desc' },
    });
  }
}