"use client";

import { type ReactNode, createContext, useContext, useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { firebaseAuth, firestore } from "@/lib/firebase/client";

type AuthState = {
  user: User | null;
  isAdmin: boolean;
  loading: boolean;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth debe usarse dentro de <AuthProvider />.");
  }
  return ctx;
}

async function checkIsAdmin(uid: string) {
  const snap = await getDoc(doc(firestore, "admins", uid));
  return snap.exists();
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [adminLoading, setAdminLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const unsub = onAuthStateChanged(firebaseAuth, async (u) => {
      if (cancelled) return;
      setUser(u);
      if (u) {
        setAdminLoading(true);
        try {
          const admin = await checkIsAdmin(u.uid);
          if (cancelled) return;
          setIsAdmin(admin);
        } catch {
          if (cancelled) return;
          setIsAdmin(false);
        } finally {
          if (!cancelled) setAdminLoading(false);
        }
      } else {
        setIsAdmin(false);
        setAdminLoading(false);
      }
      setAuthLoading(false);
    });
    return () => {
      cancelled = true;
      unsub();
    };
  }, []);

  const loading = authLoading || adminLoading;

  const value = useMemo<AuthState>(
    () => ({
      user,
      isAdmin,
      loading,
      logout: () => signOut(firebaseAuth),
    }),
    [user, isAdmin, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
