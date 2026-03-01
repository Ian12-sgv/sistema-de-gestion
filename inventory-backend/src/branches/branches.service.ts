import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';

@Injectable()
export class BranchesService {
  constructor(private prisma: PrismaService) {}

  list() {
    return this.prisma.branch.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async get(id: string) {
    const b = await this.prisma.branch.findUnique({ where: { id } });
    if (!b) throw new NotFoundException('Sucursal no existe');
    return b;
  }

  async create(dto: CreateBranchDto) {
    try {
      return await this.prisma.branch.create({ data: { ...dto } });
    } catch (e: any) {
      if (e?.code === 'P2002') throw new ConflictException('Código duplicado');
      throw e;
    }
  }

  async update(id: string, dto: UpdateBranchDto) {
    await this.get(id);
    try {
      return await this.prisma.branch.update({
        where: { id },
        data: { ...dto },
      });
    } catch (e: any) {
      if (e?.code === 'P2002') throw new ConflictException('Código duplicado');
      throw e;
    }
  }
}