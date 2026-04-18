import { BookOpen } from "lucide-react";

export default function AdminDocsPage() {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
      <div className="inline-flex items-center gap-2 rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-700">
        <BookOpen className="h-4 w-4" />
        Próximamente
      </div>
      <h1 className="mt-3 text-xl font-semibold tracking-tight text-zinc-950">Documentación</h1>
      <p className="mt-2 text-sm text-zinc-600">
        Aquí podrás crear y compartir documentación para estudiantes por materia y momento.
      </p>
    </div>
  );
}

