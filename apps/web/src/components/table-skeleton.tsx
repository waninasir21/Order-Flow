// Placeholder shown while a page's table data streams in. Each page renders its real title
// immediately and puts only the data-dependent part behind <Suspense fallback={<TableSkeleton />}>.
export function TableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div role="status" aria-label="Loading" className="overflow-hidden rounded-xl border border-line bg-surface">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex gap-4 border-b border-line px-4 py-4 last:border-0">
          <div className="skeleton h-4 w-20" />
          <div className="skeleton h-4 flex-1" />
          <div className="skeleton h-4 w-24" />
        </div>
      ))}
    </div>
  );
}
