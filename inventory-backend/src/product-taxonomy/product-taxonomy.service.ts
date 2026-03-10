import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ProductTaxonomyService {
  constructor(private prisma: PrismaService) {}

  private normalizeName(name: string) {
    return name.trim().replace(/\s+/g, ' ').toLowerCase();
  }

  async tree() {
    return this.prisma.productLine.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      include: {
        subLines: {
          where: { isActive: true },
          orderBy: { name: 'asc' },
          include: {
            categories: {
              where: { isActive: true },
              orderBy: { name: 'asc' },
              include: {
                subCategories: {
                  where: { isActive: true },
                  orderBy: { name: 'asc' },
                },
              },
            },
          },
        },
      },
    });
  }

  async createLine(name: string) {
    const cleanName = name.trim().replace(/\s+/g, ' ');
    const normalizedName = this.normalizeName(name);

    return this.prisma.productLine.upsert({
      where: { normalizedName },
      update: { name: cleanName, isActive: true },
      create: { name: cleanName, normalizedName, isActive: true },
    });
  }

  async createSubLine(lineId: string, name: string) {
    if (!lineId) throw new BadRequestException('Debes seleccionar una línea');

    const line = await this.prisma.productLine.findUnique({ where: { id: lineId } });
    if (!line) throw new NotFoundException('La línea indicada no existe');

    const cleanName = name.trim().replace(/\s+/g, ' ');
    const normalizedName = this.normalizeName(name);

    return this.prisma.productSubLine.upsert({
      where: { lineId_normalizedName: { lineId, normalizedName } },
      update: { name: cleanName, isActive: true },
      create: { lineId, name: cleanName, normalizedName, isActive: true },
    });
  }

  async createCategory(subLineId: string, name: string) {
    if (!subLineId) throw new BadRequestException('Debes seleccionar una sub línea');

    const subLine = await this.prisma.productSubLine.findUnique({ where: { id: subLineId } });
    if (!subLine) throw new NotFoundException('La sub línea indicada no existe');

    const cleanName = name.trim().replace(/\s+/g, ' ');
    const normalizedName = this.normalizeName(name);

    return this.prisma.productCategory.upsert({
      where: { subLineId_normalizedName: { subLineId, normalizedName } },
      update: { name: cleanName, isActive: true },
      create: { subLineId, name: cleanName, normalizedName, isActive: true },
    });
  }

  async createSubCategory(categoryId: string, name: string) {
    if (!categoryId) throw new BadRequestException('Debes seleccionar una categoría');

    const category = await this.prisma.productCategory.findUnique({ where: { id: categoryId } });
    if (!category) throw new NotFoundException('La categoría indicada no existe');

    const cleanName = name.trim().replace(/\s+/g, ' ');
    const normalizedName = this.normalizeName(name);

    return this.prisma.productSubCategory.upsert({
      where: { categoryId_normalizedName: { categoryId, normalizedName } },
      update: { name: cleanName, isActive: true },
      create: { categoryId, name: cleanName, normalizedName, isActive: true },
    });
  }
}
