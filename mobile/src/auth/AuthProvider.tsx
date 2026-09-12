import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, clearTokens, setTokens } from "../api/client";
import type { Me } from "../types";

type AuthContextValue = {
  user: Me | null;
  ready: boolean;
  signIn: (email: string, password: string) => Promise<Me>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Me | null>(null);
  const [ready, setReady] = useState(false);

  async function refresh() {
    try {
      const { data } = await api.get("/auth/me/");
      setUser(data);
    } catch {
      setUser(null);
    }
  }

  useEffect(() => {
    refresh().finally(() => setReady(true));
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      ready,
      async signIn(email, password) {
        const { data } = await api.post("/auth/login/", { email, password });
        await setTokens(data.tokens.access, data.tokens.refresh);
        setUser(data.user);
        return data.user as Me;
      },
      async signOut() {
        await clearTokens();
        setUser(null);
      },
      refresh,
    }),
    [user, ready],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

export function homeFor(role?: string): "/(guardian)/today" | "/driver" | "/welcome" {
  if (role === "guardian") return "/(guardian)/today";
  if (role === "driver") return "/driver";
  return "/welcome";
}
