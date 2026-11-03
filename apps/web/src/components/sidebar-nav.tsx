import Link from "next/link";
import { AnalyticsIcon, InventoryIcon, OrdersIcon } from "./icons";
import { SidebarNavActive } from "./sidebar-nav-active";

const ITEMS = [
  { href: "/orders",    label: "Orders",    Icon: OrdersIcon },
  { href: "/inventory", label: "Inventory", Icon: InventoryIcon },
  { href: "/analytics", label: "Analytics", Icon: AnalyticsIcon },
];

// Shared link renderer used by both the desktop sidebar and the mobile bottom tab bar.
// `mobile` switches the layout from a vertical list to a horizontal row of icon+label tabs.
export function NavLinks({ pathname, mobile = false }: { pathname: string | null; mobile?: boolean }) {
  if (mobile) {
    return (
      <>
        {ITEMS.map(({ href, label, Icon }) => {
          const active = pathname !== null && (pathname === href || pathname.startsWith(`${href}/`));
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium transition-colors ${
                active ? "text-accent" : "text-side-muted"
              }`}
            >
              <Icon className={active ? "text-accent" : ""} />
              {label}
            </Link>
          );
        })}
      </>
    );
  }

  return (
    <nav
      aria-label="Main"
      className="flex flex-col gap-1"
    >
      {ITEMS.map(({ href, label, Icon }) => {
        const active = pathname !== null && (pathname === href || pathname.startsWith(`${href}/`));
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
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

export function SidebarNav({ mobile = false }: { mobile?: boolean }) {
  return (
    <SidebarNavActive
      mobile={mobile}
      fallback={<NavLinks pathname={null} mobile={mobile} />}
    />
  );
}
