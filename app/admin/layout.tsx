import type { ReactNode } from "react";
import { AdminGate } from "./ui/admin-gate";
import { AdminShell } from "./ui/admin-shell";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <AdminGate>
      <AdminShell>{children}</AdminShell>
    </AdminGate>
  );
}
