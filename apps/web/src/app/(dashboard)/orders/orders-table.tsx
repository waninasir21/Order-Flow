"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { SearchIcon } from "@/components/icons";
import { EmptyState } from "@/components/empty-state";
import { OrderActions } from "@/components/order-actions";
import { StatusBadge } from "@/components/status-badge";
import { STATUSES, STATUS_LABEL, formatDateTime, formatMoney, shortId } from "@/lib/format";
import type { OrderStatus } from "@/lib/queries";
import { useOrderStatusChange } from "./use-order-status";

export interface OrderRowData {
  id: string;
  status: OrderStatus;
  createdAt: string;
  total: number;
  units: number;
  lines: number;
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
  window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
}

export function OrdersTable({ orders: serverOrders }: { orders: OrderRowData[] }) {
  const { items: orders, pending, error, dismissError, change } = useOrderStatusChange(serverOrders);
  const router = useRouter();
  const searchParams = useSearchParams();
  const [filters, setFilters] = useState<Filters>(() => readFilters(new URLSearchParams(searchParams.toString())));

  const update = (patch: Partial<Filters>) => {
    setFilters((current) => {
      const next = { ...current, page: 1, ...patch };
      writeFilters(next);
      return next;
    });
  };

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
      return sign * a.createdAt.localeCompare(b.createdAt);
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
      {/* ── Filters bar ──────────────────────────────────────────────── */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        {/* Status pills — scroll horizontally if they don't fit */}
        <div
          role="group"
          aria-label="Filter by status"
          className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-0.5 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0"
        >
          {(["ALL", ...STATUSES] as StatusFilter[]).map((s) => {
            const active = filters.status === s;
            return (
              <button
                key={s}
                type="button"
                aria-pressed={active}
                onClick={() => update({ status: s })}
                className={`shrink-0 rounded-full border px-3 py-1 text-sm font-medium transition-colors ${
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

      {error ? (
        <p
          role="alert"
          className="mb-4 flex items-start justify-between gap-3 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger"
        >
          <span>{error}</span>
          <button type="button" onClick={dismissError} className="font-semibold underline">
            Dismiss
          </button>
        </p>
      ) : null}

      {/* ── Mobile card list (hidden on md+) ─────────────────────────── */}
      <div className="md:hidden">
        {pageRows.length === 0 ? (
          <EmptyOrders orders={orders} onClear={() => setFilters(DEFAULTS)} />
        ) : (
          <ul className="space-y-2">
            {pageRows.map((o) => (
              <li key={o.id}>
                <Link
                  href={`/orders/${o.id}`}
                  className="block rounded-xl border border-line bg-surface p-4 transition-colors active:bg-bg"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium truncate">{o.outletName}</p>
                      <p className="mt-0.5 text-xs text-muted truncate">{o.repName}</p>
                    </div>
                    <StatusBadge status={o.status} />
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-4 text-sm">
                    <span className="num text-muted">{formatDateTime(o.createdAt)}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted">{o.units} unit{o.units === 1 ? "" : "s"}</span>
                      <span className="num font-semibold">{formatMoney(o.total)}</span>
                    </div>
                  </div>
                  <div className="mt-3 border-t border-line pt-3" onClick={(e) => e.preventDefault()}>
                    <OrderActions
                      status={o.status}
                      disabled={pending}
                      onChange={(to) => change(o.id, to)}
                      orderLabel={shortId(o.id)}
                    />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ── Desktop table (hidden below md) ──────────────────────────── */}
      <div className="relative hidden overflow-x-auto rounded-xl border border-line bg-surface md:block">
        <table className="w-full min-w-[980px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-line text-xs uppercase tracking-wide text-muted">
              <th scope="col" className="px-4 py-3 font-semibold">Order</th>
              <SortableTh label="Outlet" active={filters.sort === "outlet"} dir={filters.dir} onSort={() => sortBy("outlet")} />
              <th scope="col" className="px-4 py-3 font-semibold">Rep</th>
              <th scope="col" className="px-4 py-3 text-right font-semibold">Items</th>
              <SortableTh label="Total" align="right" active={filters.sort === "total"} dir={filters.dir} onSort={() => sortBy("total")} />
              <th scope="col" className="px-4 py-3 font-semibold">Status</th>
              <SortableTh label="Placed" active={filters.sort === "date"} dir={filters.dir} onSort={() => sortBy("date")} />
              <th scope="col" className="px-4 py-3 font-semibold">Actions</th>
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
                <td className="px-4 py-3">
                  <OrderActions
                    status={o.status}
                    disabled={pending}
                    onChange={(to) => change(o.id, to)}
                    orderLabel={shortId(o.id)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {pageRows.length === 0 ? <EmptyOrders orders={orders} onClear={() => setFilters(DEFAULTS)} /> : null}
      </div>

      {/* ── Pagination ───────────────────────────────────────────────── */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-muted">
        <p className="num" aria-live="polite">
          {visible.length === 0 ? "0 orders" : `Showing ${from}–${to} of ${visible.length}`}
        </p>
        <div className="flex items-center gap-2">
          <PagerButton disabled={page <= 1} onClick={() => setFilters((f) => ({ ...f, page: page - 1 }))}>
            ← Previous
          </PagerButton>
          <span className="num px-1">
            {page} / {pageCount}
          </span>
          <PagerButton disabled={page >= pageCount} onClick={() => setFilters((f) => ({ ...f, page: page + 1 }))}>
            Next →
          </PagerButton>
        </div>
      </div>
    </section>
  );
}

// Shared empty state used by both the card list and the table.
function EmptyOrders({ orders, onClear }: { orders: OrderRowData[]; onClear: () => void }) {
  return orders.length === 0 ? (
    <EmptyState
      title="No orders yet"
      description="Orders placed from the field app will appear here, newest first, ready for you to approve or reject."
    />
  ) : (
    <EmptyState
      icon={<SearchIcon />}
      title="No orders match these filters"
      description="Try a different status or a shorter search."
      action={{ label: "Clear filters", onClick: onClear }}
    />
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
