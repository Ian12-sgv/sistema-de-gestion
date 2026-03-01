import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateWarehouseDto } from './dto/create-warehouse.dto';
import { UpdateWarehouseDto } from './dto/update-warehouse.dto';

@Injectable()
export class WarehousesService {
  constructor(private prisma: PrismaService) {}

  // ✅ Soporta branchId + q (búsqueda por code o name). branchId es opcional.
  list(params?: { branchId?: string; q?: string }) {
    const branchId = params?.branchId;
    const q = (params?.q ?? '').trim();

    return this.prisma.warehouse.findMany({
      where: {
        ...(branchId ? { branchId } : {}),
        ...(q
          ? {
              OR: [
                { name: { contains: q, mode: 'insensitive' } },
                { code: { contains: q, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      include: {
        branch: { select: { id: true, code: true, name: true, type: true } },
      },
      orderBy: [{ name: 'asc' }],
    });
  }

  async get(id: string) {
    const w = await this.prisma.warehouse.findUnique({
      where: { id },
      include: {
        branch: { select: { id: true, code: true, name: true, type: true } },
      },
    });
    if (!w) throw new NotFoundException('Bodega no existe');
    return w;
  }

  async create(dto: CreateWarehouseDto) {
    try {
      return await this.prisma.warehouse.create({
        data: {
          // ✅ clave: si no viene branchId, guardamos NULL (bodega sin sucursal)
          branchId: dto.branchId ?? null,
          code: dto.code,
          name: dto.name,
          isActive: dto.isActive ?? true,
        },
        include: {
          branch: { select: { id: true, code: true, name: true, type: true } },
        },
      });
    } catch (e: any) {
      if (e?.code === 'P2002') throw new ConflictException('Código duplicado');
      throw e;
    }
  }

  async update(id: string, dto: UpdateWarehouseDto) {
    await this.get(id);
    try {
      return await this.prisma.warehouse.update({
        where: { id },
        data: {
          // ✅ si branchId viene:
          // - null => desasocia sucursal
          // - uuid => asigna
          // si no viene => no toca
          ...(dto.branchId !== undefined ? { branchId: dto.branchId } : {}),
          ...(dto.code !== undefined ? { code: dto.code } : {}),
          ...(dto.name !== undefined ? { name: dto.name } : {}),
          ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        },
        include: {
          branch: { select: { id: true, code: true, name: true, type: true } },
        },
      });
    } catch (e: any) {
      if (e?.code === 'P2002') throw new ConflictException('Código duplicado');
      throw e;
    }
  }
}