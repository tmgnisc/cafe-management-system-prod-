"use client";

/**
 * Client-side auth state + route guards.
 *
 * NOTE: these guards only improve UX. The security boundary is the PHP API,
 * which re-checks the session and role on every request.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Coffee } from "lucide-react";
import { api, setCsrfToken, UNAUTHORIZED_EVENT } from "@/lib/api";
import type { Role, User } from "@/types";

interface AuthContextValue {
  user: User | null;
  status: "loading" | "authenticated" | "unauthenticated";
  login: (email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  setUser: (u: User) => void;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function homePathFor(role: Role): string {
  return role === "SUPERADMIN" ? "/admin/dashboard" : "/pos";
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<AuthContextValue["status"]>("loading");
  const queryClient = useQueryClient();
  const router = useRouter();

  useEffect(() => {
    let active = true;
    api
      .me()
      .then((res) => {
        if (!active) return;
        setCsrfToken(res.csrf_token);
        setUser(res.user);
        setStatus("authenticated");
      })
      .catch(() => {
        if (!active) return;
        setUser(null);
        setStatus("unauthenticated");
      });
    return () => {
      active = false;
    };
  }, []);

  // Any API call returning 401 (expired session, deactivated account) logs the UI out.
  useEffect(() => {
    const onUnauthorized = () => {
      setCsrfToken(null);
      setUser(null);
      setStatus("unauthenticated");
      queryClient.clear();
    };
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
  }, [queryClient]);

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await api.login(email, password);
      setCsrfToken(res.csrf_token);
      queryClient.clear();
      setUser(res.user);
      setStatus("authenticated");
      return res.user;
    },
    [queryClient],
  );

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } finally {
      setCsrfToken(null);
      setUser(null);
      setStatus("unauthenticated");
      queryClient.clear();
      router.replace("/login");
    }
  }, [queryClient, router]);

  const value = useMemo<AuthContextValue>(
    () => ({ user, status, login, logout, setUser, isAdmin: user?.role === "SUPERADMIN" }),
    [user, status, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

export function FullScreenLoader({ label = "Brewing…" }: { label?: string }) {
  return (
    <div className="bg-cafe-texture flex min-h-screen flex-col items-center justify-center gap-3 text-muted-foreground">
      <div className="relative">
        <Coffee className="size-10 animate-pulse text-primary" />
      </div>
      <p className="font-display text-lg">{label}</p>
    </div>
  );
}

/**
 * Protects a subtree. Unauthenticated → /login?next=…; wrong role → the user's home.
 */
export function RequireAuth({ roles, children }: { roles?: Role[]; children: ReactNode }) {
  const { user, status } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const allowed = !!user && (!roles || roles.includes(user.role));

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    } else if (status === "authenticated" && user && !allowed) {
      router.replace(homePathFor(user.role));
    }
  }, [status, user, allowed, router, pathname]);

  if (status !== "authenticated" || !allowed) {
    return <FullScreenLoader label={status === "loading" ? "Brewing…" : "Redirecting…"} />;
  }
  return <>{children}</>;
}
