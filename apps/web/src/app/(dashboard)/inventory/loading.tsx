import { PageHeader } from "@/components/page-header";
import { TableSkeleton } from "@/components/table-skeleton";

// Shown during browser-level navigations to /inventory. Mirrors the Suspense fallback in page.tsx.
export default function InventoryLoading() {
  return (
    <>
      <PageHeader
        title="Inventory"
        description="Current stock for every product. Click a number to edit it."
      />
      <TableSkeleton />
    </>
  );
}
