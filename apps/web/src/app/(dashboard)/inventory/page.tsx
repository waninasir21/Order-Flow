import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { TableSkeleton } from "@/components/table-skeleton";
import { getAdmin } from "@/lib/dal";
import { gql } from "@/lib/graphql";
import { PRODUCTS, type ProductsData } from "@/lib/queries";
import { InventoryTable, type ProductRowData } from "./inventory-table";

export const metadata: Metadata = { title: "Inventory" };

// Static title first; only the data-dependent part streams in behind <Suspense>.
export default function InventoryPage() {
  return (
    <>
      <PageHeader title="Inventory" description="Current stock for every product. Click a number to edit it." />
      <Suspense fallback={<TableSkeleton />}>
        <InventoryData />
      </Suspense>
    </>
  );
}

async function InventoryData() {
  const [, data] = await Promise.all([getAdmin(), gql<ProductsData>(PRODUCTS)]);

  const rows: ProductRowData[] = data.products.map((p) => ({
    id: p.id,
    name: p.name,
    sku: p.sku,
    price: p.price,
    stock: p.stockQuantity,
  }));

  return <InventoryTable products={rows} />;
}
