import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { CreateInventoryDocDto } from './dto/create-inventory-doc.dto';
import { UpsertLinesDto } from './dto/upsert-lines.dto';
import { jsonSafe } from '../common/utils/json-safe';
import { UpdateInventoryDocDto } from './dto/update-inventory-doc.dto';

@Injectable()
export class InventoryService {
  constructor(private prisma: PrismaService) {}

  async createDraft(dto: CreateInventoryDocDto, user: AuthUser) {
    return this.prisma.inventoryDoc.create({
      data: {
        docType: dto.docType,
        status: 'DRAFT',
        fromWarehouseId: dto.fromWarehouseId ?? null,
        toWarehouseId: dto.toWarehouseId ?? null,
        notes: dto.notes ?? null,
        createdBy: user.username,
        createdByUserId: user.id,
        createdAt: new Date(),
      },
      include: { lines: true },
    });
  }

  private async getDocOrThrow(id: string) {
    const doc = await this.prisma.inventoryDoc.findUnique({
      where: { id },
      include: { lines: true },
    });
    if (!doc) throw new NotFoundException('Documento no existe');
    return doc;
  }

  // ✅ listado de docs para UI
  async listDocs(params: { status?: string; docType?: string; warehouseId?: string; from?: string; to?: string }) {
    const where: Prisma.InventoryDocWhereInput = {
      ...(params.status ? { status: params.status } : {}),
      ...(params.docType ? { docType: params.docType } : {}),
      ...(params.warehouseId
        ? { OR: [{ fromWarehouseId: params.warehouseId }, { toWarehouseId: params.warehouseId }] }
        : {}),
    };

    if (params.from || params.to) {
      const dateField = params.status === 'POSTED' ? 'postedAt' : 'createdAt';
      const range: any = {};
      if (params.from) range.gte = new Date(params.from);
      if (params.to) range.lte = new Date(params.to);
      (where as any)[dateField] = range;
    }

    const docs = await this.prisma.inventoryDoc.findMany({
      where,
      orderBy: params.status === 'POSTED' ? { postedAt: 'desc' } : { createdAt: 'desc' },
      include: {
        fromWarehouse: true,
        toWarehouse: true,
        _count: { select: { lines: true } },
      },
    });

    return jsonSafe(docs);
  }

  // ✅ get doc para UI
  async getDoc(docId: string) {
    const doc = await this.prisma.inventoryDoc.findUnique({
      where: { id: docId },
      include: {
        lines: { include: { product: true } },
        fromWarehouse: true,
        toWarehouse: true,
      },
    });
    if (!doc) throw new NotFoundException('Documento no existe');
    return jsonSafe(doc);
  }

  async getDocLines(docId: string) {
    await this.getDocOrThrow(docId);
    const lines = await this.prisma.inventoryDocLine.findMany({
      where: { docId },
      include: { product: true },
      orderBy: { id: 'asc' },
    });
    return jsonSafe(lines);
  }

  async updateDraftDoc(docId: string, dto: UpdateInventoryDocDto) {
    const doc = await this.getDocOrThrow(docId);
    if (doc.status !== 'DRAFT') throw new BadRequestException('Solo DRAFT permite editar documento');

    const updated = await this.prisma.inventoryDoc.update({
      where: { id: docId },
      data: {
        docType: dto.docType ?? undefined,
        fromWarehouseId: dto.fromWarehouseId === undefined ? undefined : dto.fromWarehouseId,
        toWarehouseId: dto.toWarehouseId === undefined ? undefined : dto.toWarehouseId,
        notes: dto.notes === undefined ? undefined : dto.notes,
      },
      include: { lines: true },
    });

    return jsonSafe(updated);
  }

  async deleteDraftDoc(docId: string) {
    const doc = await this.getDocOrThrow(docId);
    if (doc.status !== 'DRAFT') throw new BadRequestException('Solo DRAFT permite eliminar documento');

    await this.prisma.$transaction(async (tx) => {
      await tx.inventoryDocLine.deleteMany({ where: { docId } });
      await tx.inventoryDoc.delete({ where: { id: docId } });
    });

    return { deleted: true };
  }

  // ✅ Reemplaza líneas + consolida por productId (evita duplicados) + unitCost por defecto
  async upsertLines(docId: string, dto: UpsertLinesDto) {
    const doc = await this.getDocOrThrow(docId);
    if (doc.status !== 'DRAFT') throw new BadRequestException('Solo DRAFT permite editar líneas');
    if (!dto.lines || dto.lines.length === 0) throw new BadRequestException('Debe enviar al menos 1 línea');

    const map = new Map<string, { productId: string; qty: number; unitCost?: number }>();
    for (const l of dto.lines) {
      const prev = map.get(l.productId);
      if (!prev) {
        map.set(l.productId, { productId: l.productId, qty: l.qty, unitCost: l.unitCost });
      } else {
        map.set(l.productId, {
          productId: l.productId,
          qty: prev.qty + l.qty,
          unitCost: l.unitCost ?? prev.unitCost,
        });
      }
    }
    const consolidated = Array.from(map.values());

    return this.prisma.$transaction(async (tx) => {
      await tx.inventoryDocLine.deleteMany({ where: { docId } });

      const ids = consolidated.map((l) => l.productId);
      const products = await tx.product.findMany({ where: { id: { in: ids } } });
      if (products.length !== ids.length) throw new BadRequestException('Uno o más productos no existen');

      const costMap = new Map(products.map((p) => [p.id, p.cost]));

      await tx.inventoryDocLine.createMany({
        data: consolidated.map((l) => ({
          docId,
          productId: l.productId,
          qty: l.qty as any,
          unitCost: (l.unitCost ?? Number(costMap.get(l.productId) ?? 0)) as any,
        })),
      });

      return tx.inventoryDoc.findUnique({
        where: { id: docId },
        include: { lines: { include: { product: true } } },
      });
    });
  }

  async postDoc(docId: string, user: AuthUser) {
    const existing = await this.getDocOrThrow(docId);

    if (existing.status !== 'DRAFT') {
      throw new ConflictException('Documento ya fue posteado o no está en DRAFT');
    }
    if (!existing.lines || existing.lines.length === 0) {
      throw new BadRequestException('No se puede postear sin líneas');
    }

    switch (existing.docType) {
      case 'INITIAL_LOAD':
      case 'RECEIVE':
      case 'RETURN':
        if (!existing.toWarehouseId) throw new BadRequestException(`${existing.docType} requiere toWarehouseId`);
        break;

      case 'DISPATCH':
        if (!existing.fromWarehouseId) throw new BadRequestException('DISPATCH requiere fromWarehouseId');
        break;

      case 'ADJUSTMENT':
        if (!existing.toWarehouseId && !existing.fromWarehouseId) {
          throw new BadRequestException('ADJUSTMENT requiere toWarehouseId (positivo) o fromWarehouseId (negativo)');
        }
        if (existing.toWarehouseId && existing.fromWarehouseId) {
          throw new BadRequestException(
            'ADJUSTMENT debe usar solo una: toWarehouseId (positivo) o fromWarehouseId (negativo)',
          );
        }
        break;

      default:
        throw new BadRequestException(`DocType no soportado aún: ${existing.docType}`);
    }

    return this.prisma.$transaction(
      async (tx) => {
        const doc = await tx.inventoryDoc.findUnique({
          where: { id: docId },
          include: { lines: true },
        });
        if (!doc) throw new NotFoundException('Documento no existe');
        if (doc.status !== 'DRAFT') throw new ConflictException('Documento ya no está en DRAFT');

        const whIds = [doc.toWarehouseId, doc.fromWarehouseId].filter(Boolean) as string[];
        if (whIds.length) {
          const count = await tx.warehouse.count({ where: { id: { in: whIds } } });
          if (count !== whIds.length) throw new BadRequestException('Bodega no existe');
        }

        const productIds = [...new Set(doc.lines.map((l) => l.productId))];
        const prodCount = await tx.product.count({ where: { id: { in: productIds } } });
        if (prodCount !== productIds.length) throw new BadRequestException('Uno o más productos no existen');

        const seqWarehouseId =
          doc.docType === 'INITIAL_LOAD' || doc.docType === 'RECEIVE' || doc.docType === 'RETURN'
            ? doc.toWarehouseId
            : doc.docType === 'DISPATCH'
            ? doc.fromWarehouseId
            : doc.docType === 'ADJUSTMENT'
            ? doc.toWarehouseId ?? doc.fromWarehouseId
            : null;

        if (!seqWarehouseId) throw new BadRequestException('No se pudo determinar bodega para secuencia');

        await tx.documentSequence.upsert({
          where: { docType_warehouseId: { docType: doc.docType, warehouseId: seqWarehouseId } },
          update: {},
          create: {
            id: randomUUID(),
            docType: doc.docType,
            warehouseId: seqWarehouseId,
            nextNumber: BigInt(1),
          },
        });

        const seqRows = await tx.$queryRaw<{ id: string; next_number: bigint }[]>`
          SELECT id, next_number
          FROM document_sequences
          WHERE doc_type = ${doc.docType}
            AND warehouse_id IS NOT DISTINCT FROM ${seqWarehouseId}
          FOR UPDATE
        `;
        if (!seqRows[0]) throw new BadRequestException('No se pudo obtener secuencia');

        const seqId = seqRows[0].id;
        const docNumber = seqRows[0].next_number;

        await tx.$executeRaw`
          UPDATE document_sequences
          SET next_number = next_number + 1
          WHERE id = ${seqId}
        `;

        const incrementTo = async (warehouseId: string) => {
          for (const line of doc.lines) {
            await tx.stockBalance.upsert({
              where: { warehouseId_productId: { warehouseId, productId: line.productId } },
              update: { qtyOnHand: { increment: line.qty as any }, updatedAt: new Date() },
              create: { warehouseId, productId: line.productId, qtyOnHand: line.qty as any, updatedAt: new Date() },
            });
          }
        };

        const decrementFrom = async (warehouseId: string) => {
          const ids = [...new Set(doc.lines.map((l) => l.productId))];

          const rows = await tx.$queryRaw<{ product_id: string; qty_on_hand: any }[]>`
            SELECT product_id, qty_on_hand
            FROM stock_balance
            WHERE warehouse_id = ${warehouseId}
              AND product_id IN (${Prisma.join(ids)})
            FOR UPDATE
          `;

          const qtyMap = new Map<string, number>();
          for (const r of rows) {
            const n = Number(r.qty_on_hand?.toString?.() ?? r.qty_on_hand);
            qtyMap.set(r.product_id, Number.isFinite(n) ? n : 0);
          }

          for (const line of doc.lines) {
            const current = qtyMap.get(line.productId) ?? 0;
            const requested = Number(line.qty?.toString?.() ?? line.qty);
            if (current < requested) {
              throw new BadRequestException(
                `Stock insuficiente en bodega. productId=${line.productId} disponible=${current} requerido=${requested}`,
              );
            }
          }

          for (const line of doc.lines) {
            try {
              await tx.stockBalance.update({
                where: { warehouseId_productId: { warehouseId, productId: line.productId } },
                data: { qtyOnHand: { decrement: line.qty as any }, updatedAt: new Date() },
              });
            } catch {
              throw new BadRequestException(
                `Stock insuficiente en bodega. productId=${line.productId} (no existe saldo)`,
              );
            }
          }
        };

        if (doc.docType === 'INITIAL_LOAD') await incrementTo(doc.toWarehouseId!);
        if (doc.docType === 'RECEIVE') await incrementTo(doc.toWarehouseId!);
        if (doc.docType === 'RETURN') await incrementTo(doc.toWarehouseId!);

        if (doc.docType === 'DISPATCH') await decrementFrom(doc.fromWarehouseId!);

        if (doc.docType === 'ADJUSTMENT') {
          if (doc.toWarehouseId) await incrementTo(doc.toWarehouseId);
          else await decrementFrom(doc.fromWarehouseId!);
        }

        const now = new Date();
        const upd = await tx.inventoryDoc.updateMany({
          where: { id: docId, status: 'DRAFT' },
          data: {
            docNumber,
            status: 'POSTED',
            postedAt: now,
            postedBy: user.username,
            postedByUserId: user.id,
          },
        });
        if (upd.count !== 1) throw new ConflictException('Otro proceso posteó el documento');

        const posted = await tx.inventoryDoc.findUnique({
          where: { id: docId },
          include: {
            lines: { include: { product: true } },
            toWarehouse: true,
            fromWarehouse: true,
          },
        });

        return jsonSafe(posted);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async movements(params: { warehouseId?: string; productId?: string; from?: string; to?: string }) {
    const where: Prisma.InventoryDocWhereInput = {
      status: 'POSTED',
      ...(params.from || params.to
        ? {
            postedAt: {
              ...(params.from ? { gte: new Date(params.from) } : {}),
              ...(params.to ? { lte: new Date(params.to) } : {}),
            },
          }
        : {}),
      ...(params.warehouseId
        ? { OR: [{ fromWarehouseId: params.warehouseId }, { toWarehouseId: params.warehouseId }] }
        : {}),
      ...(params.productId ? { lines: { some: { productId: params.productId } } } : {}),
    };

    const docs = await this.prisma.inventoryDoc.findMany({
      where,
      orderBy: { postedAt: 'desc' },
      include: {
        lines: {
          include: { product: true },
          ...(params.productId ? { where: { productId: params.productId } } : {}),
        },
        fromWarehouse: true,
        toWarehouse: true,
      },
    });

    return jsonSafe(docs);
  }
}