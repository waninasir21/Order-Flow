import type { Product } from "@prisma/client";
import { prisma } from "../prisma";
import { Prisma } from "@prisma/client";
import { requireAuth, requireRole } from "../auth/guards";
import type { Context } from "../context";
import { badInput, notFound } from "../errors";

// Stock is an Int in GraphQL (32-bit); also keeps a typo like an extra zero from sticking.
const MAX_STOCK = 1_000_000;

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

export const catalogMutations = {
  // Sets stock to an absolute value (a stock-take / delivery correction). Order placement
  // uses atomic decrements, so a concurrent order is applied before or after this write,
  // never lost in a read-modify-write gap on the server.
  updateProductStock: async (
    _: unknown,
    args: { productId: string; stockQuantity: number },
    ctx: Context
  ) => {
    requireRole(ctx, "ADMIN");
    const { productId, stockQuantity } = args;
    if (!Number.isInteger(stockQuantity) || stockQuantity < 0 || stockQuantity > MAX_STOCK) {
      throw badInput(`Stock must be a whole number between 0 and ${MAX_STOCK}`, { stockQuantity });
    }
    try {
      return await prisma.product.update({
        where: { id: productId },
        data: { stockQuantity },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") {
        throw notFound("Product not found");
      }
      throw e;
    }
  },
};

export const productFields = {
  // Prisma returns Decimal; GraphQL Float needs a number.
  price: (p: Product) => p.price.toNumber(),
};
