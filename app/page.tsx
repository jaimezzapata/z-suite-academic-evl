export default function Home() {
  return (
    <div className="min-h-screen bg-zinc-50 px-4 py-10">
      <main className="mx-auto grid w-full max-w-xl gap-4 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-950">Z-Suite Eval</h1>
        <p className="text-sm text-zinc-600">
          Plataforma de examenes. Selecciona el acceso correspondiente.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <a
            href="/admin/login"
            className="flex h-11 items-center justify-center rounded-xl border border-zinc-200 text-sm font-medium text-zinc-800 hover:bg-zinc-100"
          >
            Panel admin
          </a>
          <a
            href="/exam"
            className="flex h-11 items-center justify-center rounded-xl bg-zinc-900 text-sm font-medium text-white hover:bg-zinc-800"
          >
            Presentar examen
          </a>
        </div>
      </main>
    </div>
  );
}
