"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  signInWithPopup,
} from "firebase/auth";
import { firebaseAuth } from "@/lib/firebase/client";
import { useAuth } from "@/app/providers";

export default function AdminLoginPage() {
  const router = useRouter();
  const { user, isAdmin, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canRedirect = useMemo(() => !loading && user && isAdmin, [loading, user, isAdmin]);
  if (canRedirect) {
    router.replace("/admin");
  }

  async function loginEmailPassword() {
    setSubmitting(true);
    setError(null);
    try {
      await signInWithEmailAndPassword(firebaseAuth, email.trim(), password);
      router.replace("/admin");
    } catch {
      setError("No fue posible iniciar sesion. Verifica tus credenciales.");
    } finally {
      setSubmitting(false);
    }
  }

  async function loginGoogle() {
    setSubmitting(true);
    setError(null);
    try {
      await signInWithPopup(firebaseAuth, new GoogleAuthProvider());
      router.replace("/admin");
    } catch {
      setError("No fue posible iniciar sesion con Google.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 px-6 py-16">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5">
        <h1 className="text-xl font-semibold tracking-tight text-zinc-950">
          Panel admin
        </h1>
        <p className="mt-1 text-sm text-zinc-600">Inicia sesion para continuar.</p>

        <div className="mt-6 grid gap-3">
          <label className="grid gap-1">
            <span className="text-sm font-medium text-zinc-800">Correo</span>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-zinc-950 outline-none focus:border-zinc-400"
              autoComplete="email"
              placeholder="admin@colegio.edu"
              disabled={submitting}
            />
          </label>
          <label className="grid gap-1">
            <span className="text-sm font-medium text-zinc-800">Contrasena</span>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-zinc-950 outline-none focus:border-zinc-400"
              autoComplete="current-password"
              placeholder="••••••••"
              disabled={submitting}
            />
          </label>

          {error ? (
            <div className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          <button
            onClick={loginEmailPassword}
            disabled={submitting || !email || !password}
            className="h-11 rounded-xl bg-zinc-900 text-sm font-medium text-white disabled:opacity-50"
          >
            Entrar
          </button>

          <div className="flex items-center gap-3 py-1">
            <div className="h-px flex-1 bg-zinc-200" />
            <div className="text-xs text-zinc-500">o</div>
            <div className="h-px flex-1 bg-zinc-200" />
          </div>

          <button
            onClick={loginGoogle}
            disabled={submitting}
            className="h-11 rounded-xl border border-zinc-200 bg-white text-sm font-medium text-zinc-950 disabled:opacity-50"
          >
            Entrar con Google
          </button>

          <p className="text-xs text-zinc-500">
            Si inicias sesion pero no eres admin, veras acceso denegado.
          </p>
        </div>
      </div>
    </div>
  );
}
