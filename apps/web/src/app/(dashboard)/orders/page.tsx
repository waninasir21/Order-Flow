import type { Metadata } from "next";
import { Suspense } from "react";
import { AutoRefresh } from "@/components/auto-refresh";
import { PageHeader } from "@/components/page-header";
import { TableSkeleton } from "@/components/table-skeleton";
import { getAdmin } from "@/lib/dal";
import { gql } from "@/lib/graphql";
import { ORDERS, type OrdersData } from "@/lib/queries";
import { OrdersTable, type OrderRowData } from "./orders-table";

export const metadata: Metadata = { title: "Orders" };

// The title is static and paints at once. Only the data-dependent part sits behind <Suspense>,
// which is what lets Next treat this route's navigations as instant (see DECISIONS.md).
export default function OrdersPage() {
  return (
    <>
      <PageHeader title="Orders" description="Every order placed from the field app, newest first. Updates every few seconds." />
      <AutoRefresh />
      <Suspense fallback={<TableSkeleton />}>
        <OrdersData />
      </Suspense>
    </>
  );
}

async function OrdersData() {
  // Both run at once. getAdmin() is the authorization check; the orders query returns every
  // order because this is an admin's token (a rep's token would only ever see their own).
  const [, data] = await Promise.all([getAdmin(), gql<OrdersData>(ORDERS)]);

  const rows: OrderRowData[] = data.orders.map((o) => ({
    id: o.id,
    status: o.status,
    createdAt: o.createdAt,
    total: o.total,
    units: o.items.reduce((sum, i) => sum + i.quantity, 0),
    lines: o.items.length,
    outletName: o.outlet.name,
    repName: o.employee.name,
  }));

  return <OrdersTable orders={rows} />;
}
