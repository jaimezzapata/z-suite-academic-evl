import { DashboardView } from "./ui/dashboard-view";

export default function AdminHomePage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-950">Dashboard</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Vista general del estado academico y operativo de la aplicacion.
        </p>
      </div>
      <DashboardView />
    </div>
  );
}
