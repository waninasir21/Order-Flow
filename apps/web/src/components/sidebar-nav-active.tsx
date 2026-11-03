"use client";

import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { NavLinks } from "./sidebar-nav";

function Active({ mobile }: { mobile: boolean }) {
  return <NavLinks pathname={usePathname()} mobile={mobile} />;
}

export function SidebarNavActive({
  fallback,
  mobile = false,
}: {
  fallback: React.ReactNode;
  mobile?: boolean;
}) {
  return (
    <Suspense fallback={fallback}>
      <Active mobile={mobile} />
    </Suspense>
  );
}
