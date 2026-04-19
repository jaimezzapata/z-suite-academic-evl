export default function Home() {
  return (
    <div className="min-h-screen bg-zinc-50 px-4 py-10">
      <main className="mx-auto w-full max-w-4xl">
        <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="inline-flex items-center gap-2 rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-700">
            Plataforma de exámenes
          </div>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-zinc-950 sm:text-5xl">
            Z-Suite Eval
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-zinc-600">
            Ingresa con tu código y presenta tu examen. Ten tu documento y correo a la mano.
          </p>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <a
              href="/exam"
              className="inline-flex h-12 items-center justify-center rounded-2xl bg-zinc-900 px-6 text-sm font-semibold text-white hover:bg-zinc-800"
            >
              Presentar examen
            </a>
          </div>

          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl bg-zinc-50 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Paso 1</p>
              <p className="mt-1 text-sm font-semibold text-zinc-900">Código de 6 dígitos</p>
              <p className="mt-1 text-xs text-zinc-600">Te lleva al examen correcto.</p>
            </div>
            <div className="rounded-2xl bg-zinc-50 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Paso 2</p>
              <p className="mt-1 text-sm font-semibold text-zinc-900">Responde y revisa</p>
              <p className="mt-1 text-xs text-zinc-600">Puedes ver el resumen antes de enviar.</p>
            </div>
            <div className="rounded-2xl bg-zinc-50 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Paso 3</p>
              <p className="mt-1 text-sm font-semibold text-zinc-900">Envío automático</p>
              <p className="mt-1 text-xs text-zinc-600">Si se acaba el tiempo, se envía.</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
