import Link from "next/link";
import { AnalyticsIcon, InventoryIcon, OrdersIcon } from "./icons";
import { SidebarNavActive } from "./sidebar-nav-active";

const ITEMS = [
  { href: "/orders", label: "Orders", Icon: OrdersIcon },
  { href: "/inventory", label: "Inventory", Icon: InventoryIcon },
  { href: "/analytics", label: "Analytics", Icon: AnalyticsIcon },
];

// The links themselves are static markup. Which one is highlighted depends on the URL, which is
// only known per request, so that part (SidebarNavActive) is a client component that streams in;
// until then the same links render with nothing highlighted.
export function NavLinks({ pathname }: { pathname: string | null }) {
  return (
    // On a phone the logo sits on one row and the links on the next (three links no longer fit beside
    // the logo); the padding keeps focus rings from being clipped by the scroll container.
    <nav aria-label="Main" className="-mx-1 flex w-full gap-1 overflow-x-auto px-1 py-1 md:mx-0 md:w-auto md:flex-col md:overflow-visible md:p-0">
      {ITEMS.map(({ href, label, Icon }) => {
        // /orders/abc123 still highlights "Orders".
        const active = pathname !== null && (pathname === href || pathname.startsWith(`${href}/`));
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              active
                ? "bg-side-active text-side-ink"
                : "text-side-muted hover:bg-side-active/60 hover:text-side-ink"
            }`}
          >
            <Icon className={active ? "text-accent" : ""} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

export function SidebarNav() {
  return <SidebarNavActive fallback={<NavLinks pathname={null} />} />;
}
