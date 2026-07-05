"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";

export interface AuraUser {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  roles: string[];
}

interface AuthContextValue {
  user: AuraUser | null;
  isLoading: boolean;
  refreshUser: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<AuraUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    const response = await fetch("/api/auth/me");
    const data = await response.json();
    setUser(data.user);
  }, []);

  useEffect(() => {
    let ignore = false;

    async function loadInitialSession() {
      const response = await fetch("/api/auth/me");
      const data = await response.json();
      if (!ignore) {
        setUser(data.user);
        setIsLoading(false);
      }
    }

    loadInitialSession();
    return () => {
      ignore = true;
    };
  }, []);

  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    // Client state alone doesn't re-run Server Component auth checks on the current route —
    // without this, logging out while on a page like /dashboard just leaves its already-rendered
    // (now-stale) protected content on screen. Refreshing re-runs that page's own redirect logic.
    router.refresh();
  }, [router]);

  const value = useMemo(() => ({ user, isLoading, refreshUser, logout }), [user, isLoading, refreshUser, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
}
