import { DangerZone } from "../danger-zone";
import { CleanCollections } from "../clean-collections";

export default function AdminFirebaseSettingsPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-zinc-950">Firebase</h1>
        <p className="mt-0.5 text-sm text-zinc-600">Herramientas de administración y mantenimiento.</p>
      </div>
      <CleanCollections />
      <DangerZone />
    </div>
  );
}

