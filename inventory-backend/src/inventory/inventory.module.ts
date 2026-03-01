import { Module } from '@nestjs/common';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';
import { InventoryDocsController } from './inventory-docs.controller';
import { MovementsController } from './movements.controller';

@Module({
  controllers: [InventoryController, InventoryDocsController, MovementsController],
  providers: [InventoryService],
})
export class InventoryModule {}