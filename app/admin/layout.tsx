"use client";

import type { ReactNode } from "react";
import { AdminGate } from "@/app/admin/ui/admin-gate";
import { AdminShell } from "@/app/admin/ui/admin-shell";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <AdminGate>
      <AdminShell>{children}</AdminShell>
    </AdminGate>
  );
}
