import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class RolesService {
  constructor(private prisma: PrismaService) {}

  listActive() {
    return this.prisma.role.findMany({
      where: { isActive: true },
      orderBy: { code: 'asc' },
    });
  }

  async getIdsByCodes(codes: string[]) {
    const roles = await this.prisma.role.findMany({
      where: { code: { in: codes }, isActive: true },
      select: { id: true, code: true },
    });
    return roles;
  }
}