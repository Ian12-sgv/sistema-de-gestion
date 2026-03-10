import { Module } from '@nestjs/common';
import { ProductTaxonomyController } from './product-taxonomy.controller';
import { ProductTaxonomyService } from './product-taxonomy.service';

@Module({
  controllers: [ProductTaxonomyController],
  providers: [ProductTaxonomyService],
})
export class ProductTaxonomyModule {}
