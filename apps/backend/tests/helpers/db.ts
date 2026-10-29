import bcrypt from "bcryptjs";
import { Prisma, type Role } from "@prisma/client";
import { prisma } from "../../src/prisma";
import type { AccessPayload } from "../../src/auth/tokens";

export async function resetDb(): Promise<void> {
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE "RefreshToken", "OrderItem", "Order", "Product", "Outlet", "Employee" RESTART IDENTITY CASCADE'
  );
}

let counter = 0;
const next = () => ++counter;

export const PASSWORD = "correct-horse-battery";

export async function createEmployee(
  opts: { role?: Role; phone?: string; name?: string; password?: string } = {}
) {
  const n = next();
  return prisma.employee.create({
    data: {
      name: opts.name ?? `Employee ${n}`,
      phone: opts.phone ?? `+9199000${String(n).padStart(5, "0")}`,
      // cost 4 keeps the suite fast; production uses the cost in the seed/app code.
      passwordHash: await bcrypt.hash(opts.password ?? PASSWORD, 4),
      role: opts.role ?? "REP",
    },
  });
}

export async function createOutlet(employeeIds: string[] = []) {
  const n = next();
  return prisma.outlet.create({
    data: {
      name: `Outlet ${n}`,
      address: `${n} Test Street`,
      ownerName: `Owner ${n}`,
      phone: `+9198000${String(n).padStart(5, "0")}`,
      employees: { connect: employeeIds.map((id) => ({ id })) },
    },
  });
}

export async function createProduct(opts: { stock?: number; price?: string; name?: string } = {}) {
  const n = next();
  return prisma.product.create({
    data: {
      name: opts.name ?? `Product ${n}`,
      sku: `SKU-${n}`,
      price: new Prisma.Decimal(opts.price ?? "10.00"),
      stockQuantity: opts.stock ?? 100,
    },
  });
}

export const asAuth = (e: { id: string; role: Role }): AccessPayload => ({
  employeeId: e.id,
  role: e.role,
});
