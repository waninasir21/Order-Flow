import { OrderStatus, Prisma } from "@prisma/client";
import { prisma } from "../prisma";

// Business days are Indian days: an order placed at 11:30 pm IST belongs to that day even
// though it is already the next day in UTC. Same zone the dashboard formats dates in.
export const ANALYTICS_TIME_ZONE = process.env.ANALYTICS_TIME_ZONE ?? "Asia/Kolkata";

// Mirrors LOW_STOCK_THRESHOLD in apps/web/src/lib/format.ts (the inventory page's definition).
export const LOW_STOCK_THRESHOLD = 10;

export interface DailyOrders {
  date: string; // YYYY-MM-DD, in ANALYTICS_TIME_ZONE
  count: number;
}

// One row per day for the last `days` days, today included, with 0 for days that had no
// orders (so a chart's x axis has no gaps). The grouping, the day boundaries and the gap
// filling all happen in Postgres; the server only converts the counts to numbers.
//
// "createdAt" is a timestamp WITHOUT time zone that Prisma stores in UTC, so it is first
// declared as UTC, then converted to the business zone; the range start goes the other way.
// This makes the result independent of the database session's own TimeZone setting.
//
// Built as a Prisma.sql value (not run here) so it can be inspected and tested on its own.
export function ordersPerDaySql(days: number, timeZone = ANALYTICS_TIME_ZONE): Prisma.Sql {
  return Prisma.sql`
    WITH bounds AS (
      SELECT (now() AT TIME ZONE ${timeZone})::date AS today
    ),
    per_day AS (
      SELECT ((o."createdAt" AT TIME ZONE 'UTC') AT TIME ZONE ${timeZone})::date AS day,
             count(*) AS orders
      FROM "Order" o, bounds b
      WHERE o."createdAt" >= (((b.today - (${days}::int - 1))::timestamp AT TIME ZONE ${timeZone}) AT TIME ZONE 'UTC')
      GROUP BY 1
    )
    SELECT to_char(d.day, 'YYYY-MM-DD') AS date,
           COALESCE(p.orders, 0)::int AS count
    FROM bounds b,
         generate_series(b.today - (${days}::int - 1), b.today, interval '1 day') AS d(day)
    LEFT JOIN per_day p ON p.day = d.day::date
    ORDER BY d.day
  `;
}

export async function ordersPerDay(days: number): Promise<DailyOrders[]> {
  const rows = await prisma.$queryRaw<{ date: string; count: number }[]>(ordersPerDaySql(days));
  return rows.map((r) => ({ date: r.date, count: Number(r.count) }));
}

// Best sellers by units ordered. Rejected orders are left out: their stock was returned, so
// they were never really sold. Ties are broken by product id so the order is stable.
export async function topProducts(limit: number) {
  const grouped = await prisma.orderItem.groupBy({
    by: ["productId"],
    where: { order: { status: { not: OrderStatus.REJECTED } } },
    _sum: { quantity: true },
    orderBy: [{ _sum: { quantity: "desc" } }, { productId: "asc" }],
    take: limit,
  });
  if (grouped.length === 0) return [];

  const products = await prisma.product.findMany({
    where: { id: { in: grouped.map((g) => g.productId) } },
  });
  const byId = new Map(products.map((p) => [p.id, p]));
  return grouped.flatMap((g) => {
    const product = byId.get(g.productId);
    return product ? [{ product, totalQuantityOrdered: g._sum.quantity ?? 0 }] : [];
  });
}

export async function analyticsSummary() {
  const [week, pendingApprovals, lowStockProducts, outOfStockProducts] = await Promise.all([
    ordersPerDay(7),
    prisma.order.count({ where: { status: OrderStatus.PLACED } }),
    prisma.product.count({ where: { stockQuantity: { gt: 0, lt: LOW_STOCK_THRESHOLD } } }),
    prisma.product.count({ where: { stockQuantity: 0 } }),
  ]);
  return {
    // Same numbers the chart shows, so the card and the chart can never disagree.
    ordersThisWeek: week.reduce((sum, d) => sum + d.count, 0),
    pendingApprovals,
    lowStockProducts,
    outOfStockProducts,
  };
}
