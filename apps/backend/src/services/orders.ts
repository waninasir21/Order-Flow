import { OrderStatus, Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import type { AccessPayload } from "../auth/tokens";
import { canTransition, ALLOWED_TRANSITIONS } from "../orderStatus";
import {
  badInput,
  conflict,
  forbidden,
  insufficientStock,
  notFound,
  unauthenticated,
} from "../errors";

export const orderInclude = {
  outlet: true,
  employee: true,
  items: { include: { product: true } },
} satisfies Prisma.OrderInclude;

export type OrderWithRelations = Prisma.OrderGetPayload<{ include: typeof orderInclude }>;

export interface OrderItemInput {
  productId: string;
  quantity: number;
}

// Neon can add latency (and a cold start), so give interactive transactions more room than the 5s default.
const TX_OPTIONS = { maxWait: 10_000, timeout: 20_000 };

export async function placeOrder(
  auth: AccessPayload,
  outletId: string,
  items: OrderItemInput[],
  clientId?: string
): Promise<OrderWithRelations> {
  if (items.length === 0) throw badInput("An order needs at least one item");
  if (clientId !== undefined && (clientId.length === 0 || clientId.length > 64)) {
    throw badInput("clientId must be between 1 and 64 characters");
  }

  // Merge duplicate lines so the same product twice becomes one line with the summed quantity.
  const wanted = new Map<string, number>();
  for (const { productId, quantity } of items) {
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw badInput("Quantity must be a positive whole number", { productId });
    }
    wanted.set(productId, (wanted.get(productId) ?? 0) + quantity);
  }

  // The token can outlive the employee (e.g. after a re-seed), which would otherwise surface as a raw FK error.
  const employee = await prisma.employee.findUnique({
    where: { id: auth.employeeId },
    select: { id: true },
  });
  if (!employee) throw unauthenticated("Account no longer exists. Please log in again.");

  // Idempotent replay: the offline queue may send the same order more than once (a lost
  // response, an app killed mid-sync). Return the order we already created instead of
  // creating a second one and deducting stock twice.
  if (clientId !== undefined) {
    const existing = await findByClientId(auth.employeeId, clientId);
    if (existing) return existing;
  }

  const outlet = await prisma.outlet.findUnique({
    where: { id: outletId },
    select: { id: true, employees: { where: { id: auth.employeeId }, select: { id: true } } },
  });
  if (!outlet) throw notFound("Outlet not found");
  // ADMIN may place an order for any outlet (acting on behalf of a rep); REP only for assigned ones.
  if (auth.role === "REP" && outlet.employees.length === 0) {
    throw forbidden("This outlet is not assigned to you");
  }

  try {
    return await placeOrderTransaction(auth, outletId, wanted, clientId);
  } catch (e) {
    // Two identical requests racing: the database's unique(employeeId, clientId) lets only
    // one win, and the whole losing transaction (including its stock changes) rolls back.
    // The loser returns the winner's order.
    if (
      clientId !== undefined &&
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2002"
    ) {
      const existing = await findByClientId(auth.employeeId, clientId);
      if (existing) return existing;
    }
    throw e;
  }
}

function findByClientId(employeeId: string, clientId: string) {
  return prisma.order.findFirst({ where: { employeeId, clientId }, include: orderInclude });
}

async function placeOrderTransaction(
  auth: AccessPayload,
  outletId: string,
  wanted: Map<string, number>,
  clientId: string | undefined
): Promise<OrderWithRelations> {
  return prisma.$transaction(async (tx) => {
    const products = await tx.product.findMany({ where: { id: { in: [...wanted.keys()] } } });
    if (products.length !== wanted.size) {
      const found = new Set(products.map((p) => p.id));
      const missing = [...wanted.keys()].filter((id) => !found.has(id));
      throw notFound("One or more products were not found", { productIds: missing });
    }

    for (const product of products) {
      const qty = wanted.get(product.id) ?? 0;
      // Conditional decrement in one statement: if two reps race for the last units,
      // only one UPDATE matches, so stock can never go negative.
      const decremented = await tx.product.updateMany({
        where: { id: product.id, stockQuantity: { gte: qty } },
        data: { stockQuantity: { decrement: qty } },
      });
      if (decremented.count === 0) {
        throw insufficientStock(`Insufficient stock for ${product.name}`, {
          productId: product.id,
          requested: qty,
          available: product.stockQuantity,
        });
      }
    }

    // Throwing above rolls the whole transaction back, so no half-created order or partial stock deduction.
    return tx.order.create({
      data: {
        outletId,
        employeeId: auth.employeeId,
        clientId,
        status: OrderStatus.PLACED,
        items: {
          create: products.map((p) => ({
            productId: p.id,
            quantity: wanted.get(p.id) ?? 0,
            priceAtOrder: p.price, // snapshot: later price changes must not rewrite history
          })),
        },
      },
      include: orderInclude,
    });
  }, TX_OPTIONS);
}

// The single place where an order's status changes. In week 6, publish the
// subscription event here (after the transaction commits).
export async function changeOrderStatus(
  orderId: string,
  to: OrderStatus
): Promise<OrderWithRelations> {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });
    if (!order) throw notFound("Order not found");

    if (!canTransition(order.status, to)) {
      const allowed = ALLOWED_TRANSITIONS[order.status];
      throw badInput(
        `Invalid status change: ${order.status} → ${to}. ` +
          (allowed.length > 0
            ? `Allowed from ${order.status}: ${allowed.join(", ")}.`
            : `${order.status} is a final status.`),
        { from: order.status, to }
      );
    }

    // Only update if the status is still what we read, so two admins can't both "win".
    const updated = await tx.order.updateMany({
      where: { id: orderId, status: order.status },
      data: { status: to },
    });
    if (updated.count === 0) {
      throw conflict("Order status was changed by someone else. Reload and try again.");
    }

    if (to === OrderStatus.REJECTED) {
      for (const item of order.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stockQuantity: { increment: item.quantity } },
        });
      }
    }

    return tx.order.findUniqueOrThrow({ where: { id: orderId }, include: orderInclude });
  }, TX_OPTIONS);
}
