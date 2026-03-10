import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@Injectable()
export class ProductsService {
  constructor(private prisma: PrismaService) {}

  private parseStatusToBoolean(status: any): boolean {
    if (typeof status === 'boolean') return status;

    const s = String(status ?? '').trim().toUpperCase();
    if (s === 'ACTIVE') return true;
    if (s === 'INACTIVE') return false;

    throw new BadRequestException('status inválido. Use ACTIVE o INACTIVE');
  }

  private statusToString(v: any): 'ACTIVE' | 'INACTIVE' {
    return v === true ? 'ACTIVE' : 'INACTIVE';
  }

  private async findProductForApi(id: string) {
    return this.prisma.product.findUnique({
      where: { id },
      include: {
        line: true,
        subLine: true,
        productCategory: true,
        subCategory: true,
      },
    });
  }

  private toApiProduct(p: any) {
    if (!p) return p;

    const cost = p.cost?.toString?.() ?? p.cost;
    const priceRetail = p.priceRetail?.toString?.() ?? p.priceRetail;
    const priceWholesale = p.priceWholesale?.toString?.() ?? p.priceWholesale;

    return {
      id: p.id,
      barcode: p.barcode,

      reference: p.reference ?? null,
      brand: p.brand ?? null,
      brandCode: p.brandCode ?? null,
      size: p.size ?? null,
      color: p.color ?? null,
      containerNumber: p.containerNumber ?? null,
      billingNumber: p.billingNumber ?? null,

      description: p.description ?? null,
      category: p.productCategory?.name ?? p.category ?? null,

      lineId: p.lineId ?? p.line?.id ?? null,
      subLineId: p.subLineId ?? p.subLine?.id ?? null,
      categoryId: p.productCategoryId ?? p.productCategory?.id ?? null,
      subCategoryId: p.subCategoryId ?? p.subCategory?.id ?? null,

      lineName: p.line?.name ?? null,
      subLineName: p.subLine?.name ?? null,
      categoryName: p.productCategory?.name ?? null,
      subCategoryName: p.subCategory?.name ?? null,

      cost,
      priceRetail,
      priceWholesale,

      status: this.statusToString(p.status),

      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    };
  }

  private async resolveHierarchy(dto: {
    lineId?: string | null;
    subLineId?: string | null;
    categoryId?: string | null;
    subCategoryId?: string | null;
  }) {
    const requestedLineId = dto.lineId ?? null;
    const requestedSubLineId = dto.subLineId ?? null;
    const requestedCategoryId = dto.categoryId ?? null;
    const requestedSubCategoryId = dto.subCategoryId ?? null;

    const line = requestedLineId
      ? await this.prisma.productLine.findUnique({ where: { id: requestedLineId } })
      : null;
    if (requestedLineId && !line) throw new NotFoundException('La línea seleccionada no existe');

    const subLine = requestedSubLineId
      ? await this.prisma.productSubLine.findUnique({
          where: { id: requestedSubLineId },
          include: { line: true },
        })
      : null;
    if (requestedSubLineId && !subLine) throw new NotFoundException('La sub línea seleccionada no existe');
    if (line && subLine && subLine.lineId !== line.id) {
      throw new BadRequestException('La sub línea no pertenece a la línea seleccionada');
    }

    const productCategory = requestedCategoryId
      ? await this.prisma.productCategory.findUnique({
          where: { id: requestedCategoryId },
          include: { subLine: { include: { line: true } } },
        })
      : null;
    if (requestedCategoryId && !productCategory) throw new NotFoundException('La categoría seleccionada no existe');
    if (subLine && productCategory && productCategory.subLineId !== subLine.id) {
      throw new BadRequestException('La categoría no pertenece a la sub línea seleccionada');
    }
    if (line && productCategory && productCategory.subLine.lineId !== line.id) {
      throw new BadRequestException('La categoría no pertenece a la línea seleccionada');
    }

    const subCategory = requestedSubCategoryId
      ? await this.prisma.productSubCategory.findUnique({
          where: { id: requestedSubCategoryId },
          include: {
            category: {
              include: {
                subLine: {
                  include: { line: true },
                },
              },
            },
          },
        })
      : null;
    if (requestedSubCategoryId && !subCategory) throw new NotFoundException('La sub categoría seleccionada no existe');
    if (productCategory && subCategory && subCategory.categoryId !== productCategory.id) {
      throw new BadRequestException('La sub categoría no pertenece a la categoría seleccionada');
    }
    if (subLine && subCategory && subCategory.category.subLineId !== subLine.id) {
      throw new BadRequestException('La sub categoría no pertenece a la sub línea seleccionada');
    }
    if (line && subCategory && subCategory.category.subLine.lineId !== line.id) {
      throw new BadRequestException('La sub categoría no pertenece a la línea seleccionada');
    }

    const resolvedLine = subCategory?.category.subLine.line ?? productCategory?.subLine.line ?? subLine?.line ?? line ?? null;
    const resolvedSubLine = subCategory?.category.subLine ?? productCategory?.subLine ?? subLine ?? null;
    const resolvedCategory = subCategory?.category ?? productCategory ?? null;
    const resolvedSubCategory = subCategory ?? null;

    return {
      lineId: resolvedLine?.id ?? null,
      subLineId: resolvedSubLine?.id ?? null,
      productCategoryId: resolvedCategory?.id ?? null,
      subCategoryId: resolvedSubCategory?.id ?? null,
      lineName: resolvedLine?.name ?? null,
      subLineName: resolvedSubLine?.name ?? null,
      categoryName: resolvedCategory?.name ?? null,
      subCategoryName: resolvedSubCategory?.name ?? null,
    };
  }

  async list() {
    const rows = await this.prisma.product.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        line: true,
        subLine: true,
        productCategory: true,
        subCategory: true,
      },
    });
    return rows.map((p) => this.toApiProduct(p));
  }

  async get(id: string) {
    const p = await this.findProductForApi(id);
    if (!p) throw new NotFoundException('Producto no existe');
    return this.toApiProduct(p);
  }

  async create(dto: CreateProductDto, user: AuthUser) {
    const exists = await this.prisma.product.findUnique({ where: { barcode: dto.barcode } });
    if (exists) throw new ConflictException('Código de barras ya existe');

    const statusBool = this.parseStatusToBoolean(dto.status);
    const hierarchy = await this.resolveHierarchy(dto);

    const created = await this.prisma.product.create({
      data: {
        barcode: dto.barcode,
        reference: dto.reference ?? null,
        brand: dto.brand ?? null,
        lineId: hierarchy.lineId,
        subLineId: hierarchy.subLineId,
        productCategoryId: hierarchy.productCategoryId,
        subCategoryId: hierarchy.subCategoryId,
        brandCode: dto.brandCode ?? null,
        size: dto.size ?? null,
        color: dto.color ?? null,
        containerNumber: dto.containerNumber ?? null,
        billingNumber: dto.billingNumber ?? null,
        category: hierarchy.categoryName ?? dto.category ?? null,
        description: dto.description ?? null,
        cost: dto.cost as any,
        priceRetail: dto.priceRetail as any,
        priceWholesale: dto.priceWholesale as any,
        status: statusBool,
      },
    });

    const targetWarehouseId =
      user?.id
        ? (
            await this.prisma.user.findUnique({
              where: { id: user.id },
              select: { defaultWarehouseId: true },
            })
          )?.defaultWarehouseId
        : null;

    let warehouseId = targetWarehouseId ?? null;

    if (!warehouseId) {
      const mainWh = await this.prisma.warehouse.findUnique({
        where: { code: 'WH-CENTRAL' },
        select: { id: true },
      });
      warehouseId = mainWh?.id ?? null;
    }

    if (warehouseId) {
      await this.prisma.stockBalance.upsert({
        where: { warehouseId_productId: { warehouseId, productId: created.id } },
        update: {},
        create: { warehouseId, productId: created.id, qtyOnHand: 0 as any, updatedAt: new Date() },
      });
    }

    const createdForApi = await this.findProductForApi(created.id);
    return this.toApiProduct(createdForApi);
  }

  async update(id: string, dto: UpdateProductDto, user: AuthUser) {
    const beforeDb = await this.findProductForApi(id);
    if (!beforeDb) throw new NotFoundException('Producto no existe');

    if (dto.barcode && dto.barcode !== beforeDb.barcode) {
      const dup = await this.prisma.product.findUnique({ where: { barcode: dto.barcode } });
      if (dup) throw new ConflictException('Código de barras ya existe');
    }

    const hierarchy =
      dto.lineId !== undefined ||
      dto.subLineId !== undefined ||
      dto.categoryId !== undefined ||
      dto.subCategoryId !== undefined
        ? await this.resolveHierarchy(dto)
        : null;

    await this.prisma.product.update({
      where: { id },
      data: {
        barcode: dto.barcode,
        reference: dto.reference === undefined ? undefined : (dto.reference ?? null),
        brand: dto.brand === undefined ? undefined : (dto.brand ?? null),
        lineId: hierarchy ? hierarchy.lineId : undefined,
        subLineId: hierarchy ? hierarchy.subLineId : undefined,
        productCategoryId: hierarchy ? hierarchy.productCategoryId : undefined,
        subCategoryId: hierarchy ? hierarchy.subCategoryId : undefined,
        brandCode: dto.brandCode === undefined ? undefined : (dto.brandCode ?? null),
        size: dto.size === undefined ? undefined : (dto.size ?? null),
        color: dto.color === undefined ? undefined : (dto.color ?? null),
        containerNumber: dto.containerNumber === undefined ? undefined : (dto.containerNumber ?? null),
        billingNumber: dto.billingNumber === undefined ? undefined : (dto.billingNumber ?? null),
        category:
          hierarchy
            ? hierarchy.categoryName ?? null
            : dto.category === undefined
            ? undefined
            : (dto.category ?? null),
        description: dto.description === undefined ? undefined : (dto.description ?? null),
        cost: dto.cost === undefined ? undefined : (dto.cost as any),
        priceRetail: dto.priceRetail === undefined ? undefined : (dto.priceRetail as any),
        priceWholesale: dto.priceWholesale === undefined ? undefined : (dto.priceWholesale as any),
        status:
          dto.status === undefined || dto.status === null
            ? undefined
            : this.parseStatusToBoolean(dto.status),
        updatedAt: new Date(),
      },
    });

    const afterDb = await this.findProductForApi(id);

    await this.prisma.productAudit.create({
      data: {
        productId: id,
        changedAt: new Date(),
        changedBy: user.username,
        changedByUserId: user.id,
        before: this.toApiProduct(beforeDb) as any,
        after: this.toApiProduct(afterDb) as any,
      },
    });

    return this.toApiProduct(afterDb);
  }

  async deactivate(id: string, user: AuthUser) {
    const beforeDb = await this.findProductForApi(id);
    if (!beforeDb) throw new NotFoundException('Producto no existe');

    if (beforeDb.status === false) {
      throw new ConflictException('Producto ya está inactivo');
    }

    await this.prisma.product.update({
      where: { id },
      data: {
        status: false,
        updatedAt: new Date(),
      },
    });

    const afterDb = await this.findProductForApi(id);

    await this.prisma.productAudit.create({
      data: {
        productId: id,
        changedAt: new Date(),
        changedBy: user.username,
        changedByUserId: user.id,
        before: this.toApiProduct(beforeDb) as any,
        after: this.toApiProduct(afterDb) as any,
      },
    });

    return this.toApiProduct(afterDb);
  }

  async audit(productId: string) {
    await this.prisma.product.findUniqueOrThrow({ where: { id: productId } });

    return this.prisma.productAudit.findMany({
      where: { productId },
      orderBy: { changedAt: 'desc' },
    });
  }
}
