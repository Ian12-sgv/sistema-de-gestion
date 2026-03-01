import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RolesService } from '../roles/roles.service';
import * as bcrypt from 'bcrypt';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { SetRolesDto } from './dto/set-roles.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService, private rolesSvc: RolesService) {}

  private toSafeUser(u: any) {
    return {
      id: u.id,
      username: u.username,
      fullName: u.fullName,
      email: u.email,
      phone: u.phone,
      mustChangePassword: u.mustChangePassword,
      isActive: u.isActive,
      defaultBranchId: u.defaultBranchId,
      defaultWarehouseId: u.defaultWarehouseId,
      createdAt: u.createdAt,
      updatedAt: u.updatedAt,
      roles: u.userRoles?.map((ur: any) => ur.role.code) ?? [],
    };
  }

  async validateCredentials(username: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { username },
      include: { userRoles: { include: { role: true } } },
    });
    if (!user || !user.isActive) return null;

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return null;

    return {
      ...this.toSafeUser(user),
    };
  }

  async findAuthUserById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { userRoles: { include: { role: true } } },
    });
    if (!user || !user.isActive) return null;

    return {
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      roles: user.userRoles.map((ur) => ur.role.code),
    };
  }

  async list() {
    const users = await this.prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      include: { userRoles: { include: { role: true } } },
    });
    return users.map((u) => this.toSafeUser(u));
  }

  async get(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { userRoles: { include: { role: true } } },
    });
    if (!user) throw new NotFoundException('Usuario no existe');
    return this.toSafeUser(user);
  }

  // ✅ PERFIL PARA FRONT: agrega nombres (branch/warehouse)
  async getMeProfile(userId: string) {
    const safe = await this.get(userId);

    const prismaAny = this.prisma as any;

    const warehouse = safe.defaultWarehouseId
      ? await prismaAny.warehouse.findUnique({
          where: { id: safe.defaultWarehouseId },
          select: { id: true, name: true, branchId: true },
        })
      : null;

    const branchId = safe.defaultBranchId ?? (warehouse?.branchId ?? null);

    const branch = branchId
      ? await prismaAny.branch.findUnique({
          where: { id: branchId },
          select: { id: true, name: true },
        })
      : null;

    return {
      ...safe,
      defaultWarehouse: warehouse ? { id: warehouse.id, name: warehouse.name } : null,
      defaultBranch: branch ? { id: branch.id, name: branch.name } : null,
    };
  }

  async create(dto: CreateUserDto) {
    const passwordHash = await bcrypt.hash(dto.password, 12);

    const roleCodes = dto.roleCodes ?? [];
    const roles = roleCodes.length ? await this.rolesSvc.getIdsByCodes(roleCodes) : [];
    if (roleCodes.length && roles.length !== roleCodes.length) {
      const found = new Set(roles.map((r) => r.code));
      const missing = roleCodes.filter((c) => !found.has(c));
      throw new BadRequestException(`Roles inválidos/inactivos: ${missing.join(', ')}`);
    }

    try {
      const created = await this.prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            username: dto.username,
            fullName: dto.fullName,
            email: dto.email ?? null,
            phone: dto.phone ?? null,
            passwordHash,
            mustChangePassword: dto.mustChangePassword ?? false,
            isActive: dto.isActive ?? true,
            defaultBranchId: dto.defaultBranchId ?? null,
            defaultWarehouseId: dto.defaultWarehouseId ?? null,
          },
        });

        if (roles.length) {
          await tx.userRole.createMany({
            data: roles.map((r) => ({ userId: user.id, roleId: r.id })),
          });
        }

        return tx.user.findUniqueOrThrow({
          where: { id: user.id },
          include: { userRoles: { include: { role: true } } },
        });
      });

      return this.toSafeUser(created);
    } catch (e: any) {
      if (e?.code === 'P2002') {
        throw new ConflictException('Dato duplicado (username/email/phone)');
      }
      throw e;
    }
  }

  async update(id: string, dto: UpdateUserDto) {
    if ((dto as any).password) {
      throw new BadRequestException('Use /users/:id/password para cambiar contraseña');
    }

    await this.get(id);

    try {
      const updated = await this.prisma.user.update({
        where: { id },
        data: {
          username: dto.username,
          fullName: dto.fullName,
          email: dto.email === undefined ? undefined : dto.email ?? null,
          phone: dto.phone === undefined ? undefined : dto.phone ?? null,
          mustChangePassword: dto.mustChangePassword,
          isActive: dto.isActive,
          defaultBranchId: dto.defaultBranchId === undefined ? undefined : dto.defaultBranchId ?? null,
          defaultWarehouseId: dto.defaultWarehouseId === undefined ? undefined : dto.defaultWarehouseId ?? null,
          updatedAt: new Date(),
        },
        include: { userRoles: { include: { role: true } } },
      });
      return this.toSafeUser(updated);
    } catch (e: any) {
      if (e?.code === 'P2002') throw new ConflictException('Dato duplicado (username/email/phone)');
      throw e;
    }
  }

  async setRoles(userId: string, dto: SetRolesDto) {
    await this.get(userId);

    const roles = await this.rolesSvc.getIdsByCodes(dto.roleCodes);
    if (roles.length !== dto.roleCodes.length) {
      const found = new Set(roles.map((r) => r.code));
      const missing = dto.roleCodes.filter((c) => !found.has(c));
      throw new BadRequestException(`Roles inválidos/inactivos: ${missing.join(', ')}`);
    }

    const result = await this.prisma.$transaction(async (tx) => {
      await tx.userRole.deleteMany({ where: { userId } });
      await tx.userRole.createMany({
        data: roles.map((r) => ({ userId, roleId: r.id })),
      });

      const user = await tx.user.findUniqueOrThrow({
        where: { id: userId },
        include: { userRoles: { include: { role: true } } },
      });
      return user;
    });

    return this.toSafeUser(result);
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    await this.get(userId);

    const passwordHash = await bcrypt.hash(dto.newPassword, 12);
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash,
        mustChangePassword: dto.mustChangePassword ?? false,
        updatedAt: new Date(),
      },
      include: { userRoles: { include: { role: true } } },
    });

    return this.toSafeUser(updated);
  }

  assertSelfOrAdmin(actor: { id: string; roles: string[] }, targetUserId: string) {
    const isAdmin = actor.roles.includes('ADMIN');
    if (!isAdmin && actor.id !== targetUserId) {
      throw new ForbiddenException('Solo ADMIN o el mismo usuario');
    }
  }
}