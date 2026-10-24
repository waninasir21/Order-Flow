import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeftIcon } from "@/components/icons";
import { StatusBadge } from "@/components/status-badge";
import { BackendError } from "@/lib/backend";
import { getAdmin } from "@/lib/dal";
import { formatDateTime, formatMoney, lineTotal, shortId } from "@/lib/format";
import { gql } from "@/lib/graphql";
import { ORDER, type OrderData } from "@/lib/queries";

export const metadata: Metadata = { title: "Order" };

// The back link is static and paints at once. The id comes from `params` (request-time data) and
// the order from the backend, so everything that needs either streams in behind <Suspense>.
export default function OrderDetailPage({ params }: PageProps<"/orders/[id]">) {
  return (
    <>
      <Link
        href="/orders"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink"
      >
        <ArrowLeftIcon /> Orders
      </Link>
      <Suspense fallback={<OrderSkeleton />}>
        <OrderDetail params={params} />
      </Suspense>
    </>
  );
}

function OrderSkeleton() {
  return (
    <div role="status" aria-label="Loading" className="space-y-6">
      <div className="skeleton h-8 w-48" />
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="skeleton h-64 !rounded-xl" />
        <div className="skeleton h-64 !rounded-xl" />
      </div>
    </div>
  );
}

async function OrderDetail({ params }: { params: PageProps<"/orders/[id]">["params"] }) {
  const { id } = await params;

  const [, data] = await Promise.all([
    getAdmin(),
    gql<OrderData>(ORDER, { id }).catch((e: unknown) => {
      if (e instanceof BackendError && e.kind === "graphql" && e.code === "NOT_FOUND") notFound();
      throw e;
    }),
  ]);
  const { order } = data;
  const units = order.items.reduce((sum, i) => sum + i.quantity, 0);

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-mono text-2xl font-semibold tracking-tight">{shortId(order.id)}</h1>
          <StatusBadge status={order.status} />
        </div>
        {/* Week 6: approve / reject buttons slot in here. */}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <section aria-labelledby="items-heading" className="overflow-hidden rounded-xl border border-line bg-surface">
          <h2 id="items-heading" className="border-b border-line px-5 py-3.5 text-sm font-semibold">
            Items <span className="num font-normal text-muted">· {units} unit{units === 1 ? "" : "s"}</span>
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-line text-xs uppercase tracking-wide text-muted">
                  <th scope="col" className="px-5 py-2.5 font-semibold">Product</th>
                  <th scope="col" className="px-5 py-2.5 text-right font-semibold">Qty</th>
                  <th scope="col" className="px-5 py-2.5 text-right font-semibold">Price at order</th>
                  <th scope="col" className="px-5 py-2.5 text-right font-semibold">Line total</th>
                </tr>
              </thead>
              <tbody>
                {order.items.map((item) => (
                  <tr key={item.id} className="border-b border-line last:border-0">
                    <td className="px-5 py-3">
                      <p className="font-medium">{item.product.name}</p>
                      <p className="font-mono text-xs text-muted">{item.product.sku}</p>
                    </td>
                    <td className="num px-5 py-3 text-right">{item.quantity}</td>
                    <td className="num px-5 py-3 text-right">{formatMoney(item.priceAtOrder)}</td>
                    <td className="num px-5 py-3 text-right font-medium">
                      {formatMoney(lineTotal(item.priceAtOrder, item.quantity))}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-line-strong">
                  <th scope="row" colSpan={3} className="px-5 py-3.5 text-right text-sm font-semibold">
                    Order total
                  </th>
                  <td className="num px-5 py-3.5 text-right text-base font-semibold">{formatMoney(order.total)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>

        <div className="space-y-6">
          <Card title="Outlet">
            <p className="font-medium">{order.outlet.name}</p>
            <p className="mt-1 text-muted">{order.outlet.address}</p>
            <Detail label="Owner" value={order.outlet.ownerName} />
            <Detail label="Phone" value={order.outlet.phone} mono />
          </Card>

          <Card title="Placed by">
            <p className="font-medium">{order.employee.name}</p>
            <Detail label="Phone" value={order.employee.phone} mono />
            <Detail label="Role" value={order.employee.role === "ADMIN" ? "Administrator" : "Sales rep"} />
          </Card>

          <Card title="Timeline">
            <Detail label="Placed" value={formatDateTime(order.createdAt)} />
            <Detail label="Last updated" value={formatDateTime(order.updatedAt)} />
            <p className="mt-3 text-xs text-muted">
              Full status history isn&apos;t recorded yet; only the current status and these two times are.
            </p>
          </Card>
        </div>
      </div>
    </>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-line bg-surface p-5 text-sm">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">{title}</h2>
      {children}
    </section>
  );
}

function Detail({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="mt-2 flex items-baseline justify-between gap-4">
      <span className="text-muted">{label}</span>
      <span className={mono ? "num font-mono" : "text-right"}>{value}</span>
    </div>
  );
}
