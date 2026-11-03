import { PageHeader } from "@/components/page-header";

// Shown during browser-level navigations to /analytics. Mirrors the AnalyticsSkeleton in page.tsx.
export default function AnalyticsLoading() {
  return (
    <>
      <PageHeader title="Analytics" description="How many orders come in, and what sells." />
      <div role="status" aria-label="Loading analytics" className="space-y-6">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="skeleton h-24 !rounded-xl" />
          ))}
        </div>
        <div className="skeleton h-96 !rounded-xl" />
        <div className="skeleton h-72 !rounded-xl" />
      </div>
    </>
  );
}
