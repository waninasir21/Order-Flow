import { EmptyState } from "@/components/empty-state";
import { SearchIcon } from "@/components/icons";

// Any URL that matches no route. (A missing order has its own, friendlier page inside the
// dashboard shell.)
export default function NotFound() {
  return (
    <main className="mx-auto grid min-h-screen max-w-lg place-items-center px-4">
      <div className="w-full rounded-xl border border-line bg-surface">
        <EmptyState
          heading="h1"
          icon={<SearchIcon />}
          title="Page not found"
          description="That address doesn't lead anywhere in the dashboard."
          action={{ href: "/orders", label: "Go to orders" }}
        />
      </div>
    </main>
  );
}
