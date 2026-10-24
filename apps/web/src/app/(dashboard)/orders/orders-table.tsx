"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { SearchIcon } from "@/components/icons";
import { StatusBadge } from "@/components/status-badge";
import { STATUSES, STATUS_LABEL, formatDateTime, formatMoney, shortId } from "@/lib/format";
import type { OrderStatus } from "@/lib/queries";

// The page maps the GraphQL result to this small shape, so the browser only receives what the
// table shows (no line items).
export interface OrderRowData {
  id: string;
  status: OrderStatus;
  createdAt: string;
  total: number;
  units: number; // total quantity across line items
  lines: number; // number of different products
  outletName: string;
  repName: string;
}

type StatusFilter = "ALL" | OrderStatus;
type SortKey = "date" | "outlet" | "total";
type Dir = "asc" | "desc";

interface Filters {
  status: StatusFilter;
  q: string;
  sort: SortKey;
  dir: Dir;
  page: number;
}

const PAGE_SIZE = 10;
const DEFAULTS: Filters = { status: "ALL", q: "", sort: "date", dir: "desc", page: 1 };

function readFilters(params: URLSearchParams): Filters {
  const status = params.get("status");
  const sort = params.get("sort");
  const dir = params.get("dir");
  const page = Number(params.get("page"));
  return {
    status: STATUSES.includes(status as OrderStatus) ? (status as OrderStatus) : "ALL",
    q: params.get("q") ?? "",
    sort: sort === "outlet" || sort === "total" || sort === "date" ? sort : "date",
    dir: dir === "asc" || dir === "desc" ? dir : sort === "outlet" ? "asc" : "desc",
    page: Number.isInteger(page) && page > 0 ? page : 1,
  };
}

// Filters live in the URL so Back from an order's detail page returns to the same view and a
// filtered list can be shared. Only non-default values are written.
function writeFilters(f: Filters) {
  const params = new URLSearchParams(window.location.search);
  const set = (key: string, value: string, isDefault: boolean) =>
    isDefault ? params.delete(key) : params.set(key, value);
  set("status", f.status, f.status === DEFAULTS.status);
  set("q", f.q, f.q === "");
  set("sort", f.sort, f.sort === DEFAULTS.sort);
  set("dir", f.dir, f.dir === (f.sort === "outlet" ? "asc" : "desc"));
  set("page", String(f.page), f.page === 1);
  const qs = params.toString();
  // The native History API is integrated with Next's router: it updates useSearchParams()
  // without asking the server to render the page again.
  window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
}

export function OrdersTable({ orders }: { orders: OrderRowData[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [filters, setFilters] = useState<Filters>(() => readFilters(new URLSearchParams(searchParams.toString())));

  useEffect(() => writeFilters(filters), [filters]);

  const update = (patch: Partial<Filters>) =>
    setFilters((current) => ({ ...current, page: 1, ...patch })); // any change returns to page 1

  const counts = useMemo(() => {
    const result: Record<StatusFilter, number> = { ALL: orders.length, PLACED: 0, APPROVED: 0, FULFILLED: 0, REJECTED: 0 };
    for (const o of orders) result[o.status] += 1;
    return result;
  }, [orders]);

  const visible = useMemo(() => {
    const needle = filters.q.trim().toLowerCase();
    const rows = orders.filter(
      (o) =>
        (filters.status === "ALL" || o.status === filters.status) &&
        (!needle ||
          o.outletName.toLowerCase().includes(needle) ||
          o.repName.toLowerCase().includes(needle) ||
          shortId(o.id).toLowerCase().includes(needle))
    );
    const sign = filters.dir === "asc" ? 1 : -1;
    rows.sort((a, b) => {
      if (filters.sort === "outlet") return sign * a.outletName.localeCompare(b.outletName);
      if (filters.sort === "total") return sign * (a.total - b.total);
      return sign * a.createdAt.localeCompare(b.createdAt); // ISO strings sort chronologically
    });
    return rows;
  }, [orders, filters]);

  const pageCount = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const page = Math.min(filters.page, pageCount);
  const pageRows = visible.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const from = visible.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, visible.length);

  const sortBy = (key: SortKey) =>
    update(
      filters.sort === key
        ? { dir: filters.dir === "asc" ? "desc" : "asc" }
        : { sort: key, dir: key === "outlet" ? "asc" : "desc" }
    );

  return (
    <section aria-label="Orders">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div role="group" aria-label="Filter by status" className="flex flex-wrap gap-1.5">
          {(["ALL", ...STATUSES] as StatusFilter[]).map((s) => {
            const active = filters.status === s;
            return (
              <button
                key={s}
                type="button"
                aria-pressed={active}
                onClick={() => update({ status: s })}
                className={`rounded-full border px-3 py-1 text-sm font-medium transition-colors ${
                  active
                    ? "border-accent bg-accent text-accent-ink"
                    : "border-line-strong bg-surface text-muted hover:text-ink"
                }`}
              >
                {s === "ALL" ? "All" : STATUS_LABEL[s]}
                <span className="num ml-1.5 opacity-70">{counts[s]}</span>
              </button>
            );
          })}
        </div>

        <label className="relative block w-full sm:w-72">
          <span className="sr-only">Search orders</span>
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="search"
            value={filters.q}
            onChange={(e) => update({ q: e.target.value })}
            placeholder="Search outlet, rep or order ID"
            className="w-full rounded-lg border border-line-strong bg-surface py-2 pl-10 pr-3 text-sm outline-none focus:border-accent"
          />
        </label>
      </div>

      <div className="overflow-x-auto rounded-xl border border-line bg-surface">
        <table className="w-full min-w-[760px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-line text-xs uppercase tracking-wide text-muted">
              <th scope="col" className="px-4 py-3 font-semibold">Order</th>
              <SortableTh label="Outlet" active={filters.sort === "outlet"} dir={filters.dir} onSort={() => sortBy("outlet")} />
              <th scope="col" className="px-4 py-3 font-semibold">Rep</th>
              <th scope="col" className="px-4 py-3 text-right font-semibold">Items</th>
              <SortableTh label="Total" align="right" active={filters.sort === "total"} dir={filters.dir} onSort={() => sortBy("total")} />
              <th scope="col" className="px-4 py-3 font-semibold">Status</th>
              <SortableTh label="Placed" active={filters.sort === "date"} dir={filters.dir} onSort={() => sortBy("date")} />
              {/* Week 6: an actions column (approve / reject) goes here. */}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((o) => (
              <tr
                key={o.id}
                onClick={(e) => {
                  if (!(e.target as HTMLElement).closest("a, button")) router.push(`/orders/${o.id}`);
                }}
                className="cursor-pointer border-b border-line last:border-0 hover:bg-bg/70"
              >
                <td className="px-4 py-3">
                  <Link href={`/orders/${o.id}`} className="font-mono font-medium text-accent hover:underline">
                    {shortId(o.id)}
                  </Link>
                </td>
                <td className="px-4 py-3 font-medium">{o.outletName}</td>
                <td className="px-4 py-3 text-muted">{o.repName}</td>
                <td className="num px-4 py-3 text-right" title={`${o.lines} product${o.lines === 1 ? "" : "s"}`}>
                  {o.units}
                </td>
                <td className="num px-4 py-3 text-right font-medium">{formatMoney(o.total)}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={o.status} />
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-muted">{formatDateTime(o.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {visible.length === 0 ? (
          <p className="px-4 py-12 text-center text-sm text-muted">
            {orders.length === 0
              ? "No orders have been placed yet."
              : "No orders match these filters."}
          </p>
        ) : null}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-muted">
        <p className="num" aria-live="polite">
          {visible.length === 0 ? "0 orders" : `Showing ${from}–${to} of ${visible.length}`}
        </p>
        <div className="flex items-center gap-2">
          <PagerButton disabled={page <= 1} onClick={() => setFilters((f) => ({ ...f, page: page - 1 }))}>
            Previous
          </PagerButton>
          <span className="num px-1">
            Page {page} of {pageCount}
          </span>
          <PagerButton disabled={page >= pageCount} onClick={() => setFilters((f) => ({ ...f, page: page + 1 }))}>
            Next
          </PagerButton>
        </div>
      </div>
    </section>
  );
}

function SortableTh({
  label,
  active,
  dir,
  onSort,
  align = "left",
}: {
  label: string;
  active: boolean;
  dir: Dir;
  onSort: () => void;
  align?: "left" | "right";
}) {
  return (
    <th
      scope="col"
      aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : "none"}
      className={`px-4 py-3 font-semibold ${align === "right" ? "text-right" : ""}`}
    >
      <button
        type="button"
        onClick={onSort}
        className={`inline-flex items-center gap-1 uppercase tracking-wide ${active ? "text-ink" : "hover:text-ink"}`}
      >
        {label}
        <span aria-hidden className="text-[11px]">{active ? (dir === "asc" ? "↑" : "↓") : "↕"}</span>
      </button>
    </th>
  );
}

function PagerButton({
  disabled,
  onClick,
  children,
}: {
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="rounded-lg border border-line-strong bg-surface px-3 py-1.5 font-medium text-ink transition-colors enabled:hover:bg-bg disabled:opacity-40"
    >
      {children}
    </button>
  );
}
