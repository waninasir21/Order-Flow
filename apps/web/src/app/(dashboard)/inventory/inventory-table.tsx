"use client";

import { useMemo, useState } from "react";
import { SearchIcon } from "@/components/icons";
import { LOW_STOCK_THRESHOLD, formatMoney } from "@/lib/format";

export interface ProductRowData {
  id: string;
  name: string;
  sku: string;
  price: number;
  stock: number;
}

export function InventoryTable({ products }: { products: ProductRowData[] }) {
  const [q, setQ] = useState("");
  const [lowOnly, setLowOnly] = useState(false);

  const stats = useMemo(
    () => ({
      total: products.length,
      low: products.filter((p) => p.stock > 0 && p.stock < LOW_STOCK_THRESHOLD).length,
      out: products.filter((p) => p.stock === 0).length,
    }),
    [products]
  );

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return products.filter(
      (p) =>
        (!lowOnly || p.stock < LOW_STOCK_THRESHOLD) &&
        (!needle || p.name.toLowerCase().includes(needle) || p.sku.toLowerCase().includes(needle))
    );
  }, [products, q, lowOnly]);

  return (
    <section aria-label="Inventory">
      <dl className="mb-6 grid grid-cols-3 gap-3">
        <Stat label="Products" value={stats.total} />
        <Stat label={`Low stock (under ${LOW_STOCK_THRESHOLD})`} value={stats.low} tone={stats.low > 0 ? "danger" : undefined} />
        <Stat label="Out of stock" value={stats.out} tone={stats.out > 0 ? "danger" : undefined} />
      </dl>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            checked={lowOnly}
            onChange={(e) => setLowOnly(e.target.checked)}
            className="size-4 accent-[var(--accent)]"
          />
          Low stock only
        </label>
        <label className="relative block w-full sm:w-72">
          <span className="sr-only">Search products</span>
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name or SKU"
            className="w-full rounded-lg border border-line-strong bg-surface py-2 pl-10 pr-3 text-sm outline-none focus:border-accent"
          />
        </label>
      </div>

      {/* `relative` matters: the table's sr-only header is absolutely positioned. Without a positioned
          scroll container it escapes the container's clipping and widens the whole page on phones. */}
      <div className="relative overflow-x-auto rounded-xl border border-line bg-surface">
        <table className="w-full min-w-[560px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-line text-xs uppercase tracking-wide text-muted">
              <th scope="col" className="px-4 py-3 font-semibold">Product</th>
              <th scope="col" className="px-4 py-3 font-semibold">SKU</th>
              <th scope="col" className="px-4 py-3 text-right font-semibold">Price</th>
              <th scope="col" className="px-4 py-3 text-right font-semibold">In stock</th>
              <th scope="col" className="px-4 py-3 font-semibold">
                <span className="sr-only">Stock level</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id} className="border-b border-line last:border-0">
                <td className="px-4 py-3 font-medium">{p.name}</td>
                <td className="px-4 py-3 font-mono text-xs text-muted">{p.sku}</td>
                <td className="num px-4 py-3 text-right">{formatMoney(p.price)}</td>
                <td className="num px-4 py-3 text-right font-medium">{p.stock}</td>
                <td className="px-4 py-3">
                  <StockBadge stock={p.stock} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 ? (
          <p className="px-4 py-12 text-center text-sm text-muted">
            {products.length === 0 ? "No products yet." : "No products match these filters."}
          </p>
        ) : null}
      </div>
    </section>
  );
}

// Red below the threshold, as the Week 5 doc asks; zero gets its own wording.
function StockBadge({ stock }: { stock: number }) {
  if (stock === 0) {
    return <span className="rounded-full bg-danger-soft px-2.5 py-0.5 text-xs font-semibold text-danger">Out of stock</span>;
  }
  if (stock < LOW_STOCK_THRESHOLD) {
    return <span className="rounded-full bg-danger-soft px-2.5 py-0.5 text-xs font-semibold text-danger">Low stock</span>;
  }
  return <span className="text-xs text-muted">OK</span>;
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "danger" }) {
  return (
    <div className="rounded-xl border border-line bg-surface px-4 py-3">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className={`num mt-1 text-2xl font-semibold ${tone === "danger" ? "text-danger" : ""}`}>{value}</dd>
    </div>
  );
}
