"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { AdminGate } from "@/app/admin/ui/admin-gate";
import { AdminShell } from "@/app/admin/ui/admin-shell";

export default function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (pathname === "/admin/login") return <>{children}</>;
  return (
    <AdminGate>
      <AdminShell>{children}</AdminShell>
    </AdminGate>
  );
}
