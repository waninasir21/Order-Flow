import Link from "next/link";

export default function OrderNotFound() {
  return (
    <div className="mx-auto max-w-md rounded-xl border border-line bg-surface p-8 text-center">
      <h1 className="text-lg font-semibold">Order not found</h1>
      <p className="mt-2 text-sm text-muted">It may have been removed, or the link is wrong.</p>
      <Link
        href="/orders"
        className="mt-5 inline-block rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-ink"
      >
        Back to orders
      </Link>
    </div>
  );
}
