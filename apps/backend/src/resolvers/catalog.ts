import type { Product } from "@prisma/client";
import { prisma } from "../prisma";
import { requireAuth } from "../auth/guards";
import type { Context } from "../context";

export const catalogQueries = {
  // Reps see only their assigned outlets; admins see all.
  outlets: (_: unknown, __: unknown, ctx: Context) => {
    const auth = requireAuth(ctx);
    return prisma.outlet.findMany({
      where: auth.role === "ADMIN" ? {} : { employees: { some: { id: auth.employeeId } } },
      orderBy: { createdAt: "asc" },
    });
  },

  products: (_: unknown, __: unknown, ctx: Context) => {
    requireAuth(ctx);
    return prisma.product.findMany({ orderBy: { createdAt: "asc" } });
  },
};

export const productFields = {
  // Prisma returns Decimal; GraphQL Float needs a number.
  price: (p: Product) => p.price.toNumber(),
};
