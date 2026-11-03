import { PageHeader } from "@/components/page-header";
import { TableSkeleton } from "@/components/table-skeleton";

// Next.js shows this file automatically during browser-level navigations (Back/Forward) and
// hard navigations to this route. It mirrors the Suspense fallback in page.tsx so the two
// loading states look identical — one for soft nav (Suspense), one for full nav (loading.tsx).
export default function OrdersLoading() {
  return (
    <>
      <PageHeader
        title="Orders"
        description="Every order placed from the field app, newest first. Updates every few seconds."
      />
      <TableSkeleton />
    </>
  );
}
