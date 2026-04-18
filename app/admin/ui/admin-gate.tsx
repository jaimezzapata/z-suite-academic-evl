"use client";

import { type ReactNode, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/app/providers";

export function AdminGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { user, isAdmin, loading, logout } = useAuth();

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/admin/login");
    }
  }, [loading, user, router]);

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center bg-zinc-50 px-6 py-16">
        <div className="text-sm text-zinc-600">Cargando...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  if (!isAdmin) {
    return (
      <div className="flex flex-1 items-center justify-center bg-zinc-50 px-6 py-16">
        <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5">
          <h1 className="text-lg font-semibold text-zinc-950">Acceso denegado</h1>
          <p className="mt-2 text-sm text-zinc-600">
            Tu cuenta inicio sesion, pero no esta autorizada como admin.
          </p>
          <div className="mt-4 rounded-xl bg-zinc-50 px-3 py-2 text-xs text-zinc-700">
            <div>UID: {user.uid}</div>
            <div>Correo: {user.email ?? "N/A"}</div>
          </div>
          <button
            onClick={() => logout()}
            className="mt-6 h-11 w-full rounded-xl bg-zinc-900 text-sm font-medium text-white"
          >
            Cerrar sesion
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
