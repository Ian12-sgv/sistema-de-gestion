// prisma/seed.ts
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';

// 1) Validar DATABASE_URL
if (!process.env.DATABASE_URL || process.env.DATABASE_URL.trim().length === 0) {
  throw new Error('❌ ERROR: La variable DATABASE_URL no está definida o está vacía en el archivo .env');
}

// (Opcional) log parcial para verificar carga sin exponer credenciales
const safeUrl = process.env.DATABASE_URL.replace(/:\/\/([^:]+):([^@]+)@/, '://$1:***@');
console.log('✅ DATABASE_URL detectada:', safeUrl);

// 2) Prisma 7+: construir PrismaClient con adapter
const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({ adapter });

async function main() {
  // 1) Roles base
  const roles = [
    { code: 'ADMIN', name: 'Administrador', description: 'Acceso total' },
    { code: 'SUPERVISOR', name: 'Supervisor', description: 'Supervisión' },
    { code: 'BODEGA', name: 'Bodega', description: 'Operador bodega' },
    { code: 'SUCURSAL', name: 'Sucursal', description: 'Operador sucursal' },
  ];

  for (const r of roles) {
    await prisma.role.upsert({
      where: { code: r.code },
      update: { name: r.name, description: r.description, isActive: true },
      create: { ...r, isActive: true },
    });
  }

  // 2) Central + bodega central (si no existen)
  const central = await prisma.branch.upsert({
    where: { code: 'CENTRAL' },
    update: { name: 'Central', type: 'CENTRAL', isActive: true },
    create: { code: 'CENTRAL', name: 'Central', type: 'CENTRAL', isActive: true },
  });

  const whCentral = await prisma.warehouse.upsert({
    where: { code: 'WH-CENTRAL' },
    update: { name: 'Bodega Central', branchId: central.id, isActive: true },
    create: { code: 'WH-CENTRAL', name: 'Bodega Central', branchId: central.id, isActive: true },
  });

  // 3) Admin
  const username = 'admin';
  const password = 'Admin123!'; // cámbiala apenas inicies
  const passwordHash = await bcrypt.hash(password, 12);

  const admin = await prisma.user.upsert({
    where: { username },
    update: {
      fullName: 'Admin',
      isActive: true,
      mustChangePassword: true,
      passwordHash,
      defaultBranchId: central.id,
      defaultWarehouseId: whCentral.id,
    },
    create: {
      username,
      fullName: 'Admin',
      passwordHash,
      mustChangePassword: true,
      isActive: true,
      defaultBranchId: central.id,
      defaultWarehouseId: whCentral.id,
    },
  });

  const adminRole = await prisma.role.findUniqueOrThrow({
    where: { code: 'ADMIN' },
  });

  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: admin.id, roleId: adminRole.id } },
    update: {},
    create: { userId: admin.id, roleId: adminRole.id },
  });

  // 4) Secuencia INITIAL_LOAD por bodega (recomendado)
  // Nota: en tu schema prisma, DocumentSequence tiene id con default(uuid()).
  // Pero como tu DB "ya existe", a veces no tiene default a nivel DB.
  // Para evitar errores, seteamos id explícito.
  await prisma.documentSequence.upsert({
    where: { docType_warehouseId: { docType: 'INITIAL_LOAD', warehouseId: whCentral.id } },
    update: {},
    create: {
      id: randomUUID(),
      docType: 'INITIAL_LOAD',
      warehouseId: whCentral.id,
      nextNumber: BigInt(1),
    },
  });

  console.log('✅ Seed OK. Admin:', username, 'Pass:', password);
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
