import { requireRole } from "../auth/guards";
import type { Context } from "../context";
import { badInput } from "../errors";
import { analyticsSummary, ordersPerDay, topProducts } from "../services/analytics";

const MAX_DAYS = 90;
const MAX_LIMIT = 20;

function intInRange(value: number, min: number, max: number, name: string): number {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw badInput(`${name} must be a whole number from ${min} to ${max}`, { [name]: value });
  }
  return value;
}

// Analytics are an admin feature (they cover every rep's orders).
export const analyticsQueries = {
  ordersPerDay: (_: unknown, args: { days?: number | null }, ctx: Context) => {
    requireRole(ctx, "ADMIN");
    return ordersPerDay(intInRange(args.days ?? 14, 1, MAX_DAYS, "days"));
  },
  topProducts: (_: unknown, args: { limit?: number | null }, ctx: Context) => {
    requireRole(ctx, "ADMIN");
    return topProducts(intInRange(args.limit ?? 5, 1, MAX_LIMIT, "limit"));
  },
  analyticsSummary: (_: unknown, __: unknown, ctx: Context) => {
    requireRole(ctx, "ADMIN");
    return analyticsSummary();
  },
};
