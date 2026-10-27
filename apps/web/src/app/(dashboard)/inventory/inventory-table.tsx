"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { EmptyState } from "@/components/empty-state";
import { SearchIcon } from "@/components/icons";
import { LOW_STOCK_THRESHOLD, formatMoney } from "@/lib/format";
import { MAX_STOCK, parseStock } from "@/lib/stock";
import { useStockEdit } from "./use-stock-edit";

export interface ProductRowData {
  id: string;
  name: string;
  sku: string;
  price: number;
  stock: number;
}

export function InventoryTable({ products: serverProducts }: { products: ProductRowData[] }) {
  const { items: products, pending, error, dismissError, save } = useStockEdit(serverProducts);
  const [editingId, setEditingId] = useState<string | null>(null);
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
        <table className="w-full min-w-[640px] border-collapse text-left text-sm">
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
                <td className="px-4 py-2 text-right">
                  {editingId === p.id ? (
                    <StockEditor
                      initial={p.stock}
                      name={p.name}
                      busy={pending}
                      onCancel={() => setEditingId(null)}
                      onSave={(value) => {
                        setEditingId(null);
                        if (value !== p.stock) save(p.id, value);
                      }}
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => setEditingId(p.id)}
                      aria-label={`Edit stock for ${p.name}, currently ${p.stock}`}
                      className="num rounded-md px-2 py-1 font-medium underline decoration-line-strong decoration-dotted underline-offset-4 hover:bg-bg"
                    >
                      {p.stock}
                    </button>
                  )}
                </td>
                <td className="px-4 py-3">
                  <StockBadge stock={p.stock} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 ? (
          products.length === 0 ? (
            <EmptyState
              title="No products yet"
              description="Add products to the catalog (the seed script does this for the demo data) and their stock levels will show up here."
            />
          ) : (
            <EmptyState
              icon={<SearchIcon />}
              title="No products match these filters"
              description="Try a different name or SKU, or turn off “Low stock only”."
              action={{
                label: "Clear filters",
                onClick: () => {
                  setQ("");
                  setLowOnly(false);
                },
              }}
            />
          )
        ) : null}
      </div>
    </section>
  );
}

// Inline editor: Enter or Save commits, Escape or Cancel discards. (No save/cancel on blur: Safari
// doesn't focus buttons on click, so a blur handler would cancel before Save could fire.)
function StockEditor({
  initial,
  name,
  busy,
  onSave,
  onCancel,
}: {
  initial: number;
  name: string;
  busy: boolean;
  onSave: (value: number) => void;
  onCancel: () => void;
}) {
  const [text, setText] = useState(String(initial));
  const [problem, setProblem] = useState<string | null>(null);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => ref.current?.select(), []);

  const submit = () => {
    const parsed = parseStock(text);
    if ("error" in parsed) setProblem(parsed.error);
    else onSave(parsed.value);
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="flex flex-col items-end gap-1"
    >
      <div className="flex items-center gap-1.5">
        <input
          ref={ref}
          value={text}
          inputMode="numeric"
          disabled={busy}
          aria-label={`New stock for ${name} (0 to ${MAX_STOCK})`}
          aria-invalid={problem ? true : undefined}
          onChange={(e) => {
            setText(e.target.value);
            setProblem(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") onCancel();
          }}
          className="num w-24 rounded-md border border-line-strong bg-bg px-2 py-1 text-right outline-none focus:border-accent"
        />
        <button type="submit" disabled={busy} className="rounded-md bg-accent px-2.5 py-1 text-xs font-semibold text-accent-ink disabled:opacity-50">
          Save
        </button>
        <button type="button" onClick={onCancel} className="rounded-md border border-line-strong px-2.5 py-1 text-xs font-medium hover:bg-bg">
          Cancel
        </button>
      </div>
      {problem ? (
        <p role="alert" className="text-xs text-danger">
          {problem}
        </p>
      ) : null}
    </form>
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
