import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { OrdersPerDayChart, TopProductsChart } from "@/components/charts";
import { EmptyState } from "@/components/empty-state";
import { AnalyticsIcon } from "@/components/icons";
import { PageHeader } from "@/components/page-header";
import { getAdmin } from "@/lib/dal";
import { gql } from "@/lib/graphql";
import { ANALYTICS, type AnalyticsData } from "@/lib/queries";

export const metadata: Metadata = { title: "Analytics" };

const RANGES = [7, 14, 30] as const;
const DEFAULT_DAYS = 14;
const TOP_PRODUCTS = 5;

// Static title paints at once; the numbers stream in behind <Suspense> (same pattern as the
// other pages). The range comes from the URL (?days=7|14|30), so it can be linked and survives
// a reload; the server renders the page again for each choice.
export default function AnalyticsPage({ searchParams }: PageProps<"/analytics">) {
  return (
    <>
      <PageHeader title="Analytics" description="How many orders come in, and what sells." />
      <Suspense fallback={<AnalyticsSkeleton />}>
        <AnalyticsData searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function AnalyticsData({ searchParams }: { searchParams: PageProps<"/analytics">["searchParams"] }) {
  const params = await searchParams;
  const requested = Number(Array.isArray(params.days) ? params.days[0] : params.days);
  const days = (RANGES as readonly number[]).includes(requested) ? requested : DEFAULT_DAYS;

  // The aggregation happens in the database (the backend's ordersPerDay / topProducts); this
  // page only draws the result.
  const [, data] = await Promise.all([
    getAdmin(),
    gql<AnalyticsData>(ANALYTICS, { days, limit: TOP_PRODUCTS }),
  ]);
  const { analyticsSummary: s, ordersPerDay, topProducts } = data;
  const total = ordersPerDay.reduce((sum, d) => sum + d.count, 0);

  return (
    <div className="space-y-6">
      <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Summary">
        <StatCard label="Orders this week" value={s.ordersThisWeek} hint="Last 7 days" />
        <StatCard
          label="Pending approvals"
          value={s.pendingApprovals}
          tone={s.pendingApprovals > 0 ? "warn" : undefined}
          href="/orders?status=PLACED"
          hint="Review orders"
        />
        <StatCard
          label="Low stock"
          value={s.lowStockProducts}
          tone={s.lowStockProducts > 0 ? "danger" : undefined}
          href="/inventory"
          hint="Fewer than 10 left"
        />
        <StatCard
          label="Out of stock"
          value={s.outOfStockProducts}
          tone={s.outOfStockProducts > 0 ? "danger" : undefined}
          href="/inventory"
          hint="Nothing left"
        />
      </ul>

      <section aria-labelledby="per-day-heading" className="rounded-xl border border-line bg-surface p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 id="per-day-heading" className="text-sm font-semibold">
            Orders per day{" "}
            <span className="num font-normal text-muted">
              · {total} in the last {days} days
            </span>
          </h2>
          <nav aria-label="Time range" className="flex gap-1.5">
            {RANGES.map((r) => (
              <Link
                key={r}
                href={`/analytics?days=${r}`}
                aria-current={r === days ? "true" : undefined}
                className={`rounded-full border px-3 py-1 text-sm font-medium transition-colors ${
                  r === days
                    ? "border-accent bg-accent text-accent-ink"
                    : "border-line-strong text-muted hover:text-ink"
                }`}
              >
                {r} days
              </Link>
            ))}
          </nav>
        </div>
        {total === 0 ? (
          <EmptyState
            icon={<AnalyticsIcon />}
            title="No orders in this period"
            description="Orders placed from the field app show up here as soon as they come in. Try a longer range."
          />
        ) : (
          <OrdersPerDayChart data={ordersPerDay} />
        )}
      </section>

      <section aria-labelledby="top-heading" className="rounded-xl border border-line bg-surface p-5">
        <h2 id="top-heading" className="mb-4 text-sm font-semibold">
          Best sellers <span className="font-normal text-muted">· units ordered, rejected orders excluded</span>
        </h2>
        {topProducts.length === 0 ? (
          <EmptyState
            title="No sales yet"
            description="Once orders are placed, the products that sell most appear here."
          />
        ) : (
          <TopProductsChart data={topProducts.map((t) => ({ name: t.product.name, units: t.totalQuantityOrdered }))} />
        )}
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
  href,
  tone,
}: {
  label: string;
  value: number;
  hint: string;
  href?: string;
  tone?: "warn" | "danger";
}) {
  const color = tone === "danger" ? "text-danger" : tone === "warn" ? "text-warn" : "";
  // A list of cards (not a <dl>): some cards are links, and a link can't sit directly inside a
  // <dl>. Each card reads as "label, value, hint" in that order.
  const body = (
    <>
      <span className="block text-xs text-muted">{label}</span>
      <span className={`num mt-1 block text-3xl font-semibold ${color}`}>{value}</span>
      <span className="mt-1 block text-xs text-muted">{hint}</span>
    </>
  );
  const box = "block rounded-xl border border-line bg-surface px-4 py-3";
  return (
    <li>
      {href ? (
        <Link href={href} className={`${box} transition-colors hover:border-line-strong`}>
          {body}
        </Link>
      ) : (
        <div className={box}>{body}</div>
      )}
    </li>
  );
}

function AnalyticsSkeleton() {
  return (
    <div role="status" aria-label="Loading analytics" className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="skeleton h-24 !rounded-xl" />
        ))}
      </div>
      <div className="skeleton h-96 !rounded-xl" />
      <div className="skeleton h-72 !rounded-xl" />
    </div>
  );
}
