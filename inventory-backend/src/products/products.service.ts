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

  private toApiProduct(p: any) {
    if (!p) return p;

    // Prisma Decimal suele serializar a string con toString()
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
      category: p.category ?? null,

      cost,
      priceRetail,
      priceWholesale,

      status: this.statusToString(p.status),

      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    };
  }

  async list() {
    const rows = await this.prisma.product.findMany({ orderBy: { createdAt: 'desc' } });
    return rows.map((p) => this.toApiProduct(p));
  }

  async get(id: string) {
    const p = await this.prisma.product.findUnique({ where: { id } });
    if (!p) throw new NotFoundException('Producto no existe');
    return this.toApiProduct(p);
  }

  // ✅ Registro único por producto + validación duplicidad barcode
  async create(dto: CreateProductDto, user: AuthUser) {
    const exists = await this.prisma.product.findUnique({ where: { barcode: dto.barcode } });
    if (exists) throw new ConflictException('Código de barras ya existe');

    const statusBool = this.parseStatusToBoolean(dto.status);

    const created = await this.prisma.product.create({
      data: {
        barcode: dto.barcode,

        reference: dto.reference ?? null,
        brand: dto.brand ?? null,

        // ✅ NUEVOS CAMPOS
        brandCode: dto.brandCode ?? null,
        size: dto.size ?? null,
        color: dto.color ?? null,
        containerNumber: dto.containerNumber ?? null,
        billingNumber: dto.billingNumber ?? null,

        category: dto.category ?? null,
        description: dto.description ?? null,

        cost: dto.cost as any,
        priceRetail: dto.priceRetail as any,
        priceWholesale: dto.priceWholesale as any,

        status: statusBool,
      },
    });

    // ✅ Regla stock_balance en 0 (defaultWarehouse del creador o WH-CENTRAL)
    const targetWarehouseId =
      user?.id
        ? (await this.prisma.user.findUnique({
            where: { id: user.id },
            select: { defaultWarehouseId: true },
          }))?.defaultWarehouseId
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

    return this.toApiProduct(created);
  }

  // ✅ Editar + audit
  async update(id: string, dto: UpdateProductDto, user: AuthUser) {
    const beforeDb = await this.prisma.product.findUnique({ where: { id } });
    if (!beforeDb) throw new NotFoundException('Producto no existe');

    if (dto.barcode && dto.barcode !== beforeDb.barcode) {
      const dup = await this.prisma.product.findUnique({ where: { barcode: dto.barcode } });
      if (dup) throw new ConflictException('Código de barras ya existe');
    }

    const afterDb = await this.prisma.product.update({
      where: { id },
      data: {
        barcode: dto.barcode,

        reference: dto.reference === undefined ? undefined : (dto.reference ?? null),
        brand: dto.brand === undefined ? undefined : (dto.brand ?? null),

        // ✅ NUEVOS CAMPOS
        brandCode: dto.brandCode === undefined ? undefined : (dto.brandCode ?? null),
        size: dto.size === undefined ? undefined : (dto.size ?? null),
        color: dto.color === undefined ? undefined : (dto.color ?? null),
        containerNumber: dto.containerNumber === undefined ? undefined : (dto.containerNumber ?? null),
        billingNumber: dto.billingNumber === undefined ? undefined : (dto.billingNumber ?? null),

        category: dto.category === undefined ? undefined : (dto.category ?? null),
        description: dto.description === undefined ? undefined : (dto.description ?? null),

        cost: dto.cost === undefined ? undefined : (dto.cost as any),
        priceRetail: dto.priceRetail === undefined ? undefined : (dto.priceRetail as any),
        priceWholesale: dto.priceWholesale === undefined ? undefined : (dto.priceWholesale as any),

        // ✅ status: si viene null/undefined no toca
        status:
          dto.status === undefined || dto.status === null
            ? undefined
            : this.parseStatusToBoolean(dto.status),

        updatedAt: new Date(),
      },
    });

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

  // ✅ Soft delete = status=false + audit
  async deactivate(id: string, user: AuthUser) {
    const beforeDb = await this.prisma.product.findUnique({ where: { id } });
    if (!beforeDb) throw new NotFoundException('Producto no existe');

    if (beforeDb.status === false) {
      throw new ConflictException('Producto ya está inactivo');
    }

    const afterDb = await this.prisma.product.update({
      where: { id },
      data: {
        status: false,
        updatedAt: new Date(),
      },
    });

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
    // valida existencia
    await this.prisma.product.findUniqueOrThrow({ where: { id: productId } });

    return this.prisma.productAudit.findMany({
      where: { productId },
      orderBy: { changedAt: 'desc' },
    });
  }
}