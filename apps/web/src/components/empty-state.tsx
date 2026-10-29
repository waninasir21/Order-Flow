import Link from "next/link";
import { EmptyBoxIcon } from "./icons";

// A deliberate "nothing here yet" screen: says what this place is for, why it's empty and what
// to do next, instead of a bare empty table.
export function EmptyState({
  title,
  description,
  action,
  icon,
  heading: Heading = "h2",
}: {
  title: string;
  description: string;
  action?: { href: string; label: string } | { onClick: () => void; label: string };
  icon?: React.ReactNode;
  // h2 inside a page that already has an h1; h1 when the empty state IS the page (404).
  heading?: "h1" | "h2";
}) {
  const button =
    "mt-5 inline-block rounded-lg border border-line-strong px-4 py-2 text-sm font-medium transition-colors hover:bg-bg";
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <span aria-hidden className="grid size-14 place-items-center rounded-full bg-accent-soft text-accent">
        {icon ?? <EmptyBoxIcon />}
      </span>
      <Heading className="mt-4 text-base font-semibold">{title}</Heading>
      <p className="mt-1 max-w-sm text-sm text-muted">{description}</p>
      {action && "href" in action ? (
        <Link href={action.href} className={button}>
          {action.label}
        </Link>
      ) : action ? (
        <button type="button" onClick={action.onClick} className={button}>
          {action.label}
        </button>
      ) : null}
    </div>
  );
}
