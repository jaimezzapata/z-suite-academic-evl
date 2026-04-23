"use client";

import { useEffect, useMemo, useState } from "react";
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
  useEffect(() => {
    if (canRedirect) router.replace("/admin");
  }, [canRedirect, router]);

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
    <div className="flex flex-1 items-center justify-center bg-background px-6 py-16">
      <div className="w-full max-w-sm zs-card p-6">
        <div className="mb-5 flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-sm font-semibold text-white shadow-sm">
            ZS
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold tracking-tight text-foreground">Panel admin</h1>
            <p className="mt-0.5 text-sm text-foreground/65">Inicia sesion para continuar.</p>
          </div>
        </div>

        <div className="mt-6 grid gap-3">
          <label className="grid gap-1">
            <span className="text-sm font-medium text-foreground/80">Correo</span>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              className="zs-input"
              autoComplete="email"
              placeholder="admin@colegio.edu"
              disabled={submitting}
            />
          </label>
          <label className="grid gap-1">
            <span className="text-sm font-medium text-foreground/80">Contrasena</span>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              className="zs-input"
              autoComplete="current-password"
              placeholder="••••••••"
              disabled={submitting}
            />
          </label>

          {error ? (
            <div className="rounded-xl border border-danger/25 bg-danger/10 px-3 py-2 text-sm text-danger">
              {error}
            </div>
          ) : null}

          <button
            onClick={loginEmailPassword}
            disabled={submitting || !email || !password}
            className="zs-btn-primary h-11"
          >
            Entrar
          </button>

          <div className="flex items-center gap-3 py-1">
            <div className="h-px flex-1 bg-border" />
            <div className="text-xs text-foreground/55">o</div>
            <div className="h-px flex-1 bg-border" />
          </div>

          <button
            onClick={loginGoogle}
            disabled={submitting}
            className="zs-btn-secondary h-11"
          >
            Entrar con Google
          </button>

          <p className="text-xs text-foreground/55">
            Si inicias sesion pero no eres admin, veras acceso denegado.
          </p>
        </div>
      </div>
    </div>
  );
}
