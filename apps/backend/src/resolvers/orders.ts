import { Prisma, type OrderStatus } from "@prisma/client";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../auth/guards";
import type { Context } from "../context";
import {
  changeOrderStatus,
  orderInclude,
  placeOrder,
  type OrderItemInput,
  type OrderWithRelations,
} from "../services/orders";

export const orderQueries = {
  // Reps get their own orders; admins get everything. Optional filters narrow either.
  orders: (
    _: unknown,
    args: { outletId?: string | null; status?: OrderStatus | null },
    ctx: Context
  ) => {
    const auth = requireAuth(ctx);
    return prisma.order.findMany({
      where: {
        ...(auth.role === "REP" ? { employeeId: auth.employeeId } : {}),
        ...(args.outletId ? { outletId: args.outletId } : {}),
        ...(args.status ? { status: args.status } : {}),
      },
      include: orderInclude,
      orderBy: { createdAt: "desc" },
    });
  },
};

export const orderMutations = {
  createOrder: (
    _: unknown,
    args: { outletId: string; items: OrderItemInput[] },
    ctx: Context
  ) => {
    const auth = requireAuth(ctx);
    return placeOrder(auth, args.outletId, args.items);
  },

  updateOrderStatus: (
    _: unknown,
    args: { orderId: string; status: OrderStatus },
    ctx: Context
  ) => {
    requireRole(ctx, "ADMIN");
    return changeOrderStatus(args.orderId, args.status);
  },
};

export const orderFields = {
  createdAt: (o: OrderWithRelations) => o.createdAt.toISOString(),
  updatedAt: (o: OrderWithRelations) => o.updatedAt.toISOString(),
  total: (o: OrderWithRelations) =>
    o.items
      .reduce((sum, i) => sum.plus(i.priceAtOrder.mul(i.quantity)), new Prisma.Decimal(0))
      .toNumber(),
};

export const orderItemFields = {
  priceAtOrder: (i: OrderWithRelations["items"][number]) => i.priceAtOrder.toNumber(),
};
