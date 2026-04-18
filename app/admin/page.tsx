import { AdminGate } from "./ui/admin-gate";

export default function AdminHomePage() {
  return (
    <AdminGate>
      <div className="mx-auto w-full max-w-4xl px-6 py-12">
        <div className="flex items-center justify-between gap-6">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-950">
              Panel admin
            </h1>
            <p className="mt-1 text-sm text-zinc-600">
              Sesion iniciada correctamente.
            </p>
          </div>
        </div>
      </div>
    </AdminGate>
  );
}
