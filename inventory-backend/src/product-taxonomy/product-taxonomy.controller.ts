import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { ProductTaxonomyService } from './product-taxonomy.service';
import { CreateTaxonomyItemDto } from './dto/create-taxonomy-item.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('product-taxonomy')
export class ProductTaxonomyController {
  constructor(private readonly svc: ProductTaxonomyService) {}

  @Roles('ADMIN', 'SUPERVISOR', 'BODEGA', 'SUCURSAL')
  @Get('tree')
  tree() {
    return this.svc.tree();
  }

  @Roles('ADMIN', 'SUPERVISOR')
  @Post('lines')
  createLine(@Body() dto: CreateTaxonomyItemDto) {
    return this.svc.createLine(dto.name);
  }

  @Roles('ADMIN', 'SUPERVISOR')
  @Post('sub-lines')
  createSubLine(@Body() dto: CreateTaxonomyItemDto) {
    return this.svc.createSubLine(dto.lineId ?? '', dto.name);
  }

  @Roles('ADMIN', 'SUPERVISOR')
  @Post('categories')
  createCategory(@Body() dto: CreateTaxonomyItemDto) {
    return this.svc.createCategory(dto.subLineId ?? '', dto.name);
  }

  @Roles('ADMIN', 'SUPERVISOR')
  @Post('sub-categories')
  createSubCategory(@Body() dto: CreateTaxonomyItemDto) {
    return this.svc.createSubCategory(dto.categoryId ?? '', dto.name);
  }
}
