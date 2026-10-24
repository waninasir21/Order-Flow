"use client";

import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { NavLinks } from "./sidebar-nav";

function Active() {
  return <NavLinks pathname={usePathname()} />;
}

export function SidebarNavActive({ fallback }: { fallback: React.ReactNode }) {
  return (
    <Suspense fallback={fallback}>
      <Active />
    </Suspense>
  );
}
