import { DangerZone } from "../settings/danger-zone";

export default function AdminDangerZonePage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-zinc-950">DangerZone</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Acciones críticas de configuración y limpieza del entorno.
        </p>
      </div>
      <DangerZone />
    </div>
  );
}

