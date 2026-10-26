"use server";

import { refresh } from "next/cache";
import { toFailure, type ActionResult } from "@/lib/action-result";
import { getAdmin } from "@/lib/dal";
import { gql } from "@/lib/graphql";
import { UPDATE_PRODUCT_STOCK } from "@/lib/queries";
import { MAX_STOCK } from "@/lib/stock";

export async function updateProductStockAction(productId: string, stockQuantity: number): Promise<ActionResult> {
  await getAdmin();
  if (typeof productId !== "string" || productId.length === 0 || productId.length > 64) {
    return { ok: false, message: "Invalid product." };
  }
  if (!Number.isInteger(stockQuantity) || stockQuantity < 0 || stockQuantity > MAX_STOCK) {
    return { ok: false, message: `Stock must be a whole number from 0 to ${MAX_STOCK.toLocaleString("en-IN")}.` };
  }

  try {
    await gql(UPDATE_PRODUCT_STOCK, { productId, stockQuantity });
  } catch (e) {
    const failure = toFailure(e);
    if (failure.stale) refresh();
    return { ok: false, message: failure.message };
  }
  refresh();
  return { ok: true };
}
