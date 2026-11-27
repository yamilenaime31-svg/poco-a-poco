import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { setFixedDate } from "@/src/constants";
import { api, loadToken, setToken } from "@/src/api";
import { queryClient } from "@/src/query-client";

export type User = {
  id: string;
  email: string;
  is_admin?: boolean;
  plan_chosen?: boolean;
  name: string;
  preferred_name: string;
  role: "patient" | "caregiver";
  roles: string[];
  invite_code: string;
  onboarding_done: boolean;
  profile: Record<string, any>;
  settings: Record<string, any>;
};

type Ctx = {
  user: User | null;
  ready: boolean;
  textScale: number;
  signIn: (token: string, user: User) => Promise<void>;
  signOut: () => Promise<void>;
  updateMe: (patch: Record<string, any>) => Promise<User>;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<Ctx>({} as Ctx);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUserState] = useState<User | null>(null);
  const setUser = useCallback((u: User | null) => {
    setFixedDate((u as any)?.demo_clock);  // before any screen asks for "today"
    setUserState(u);
  }, []);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      const t = await loadToken();
      if (t) {
        try {
          setUser(await api<User>("/me"));
        } catch {
          await setToken(null);
        }
      }
      setReady(true);
    })();
  }, []);

  const signIn = useCallback(async (token: string, u: User) => {
    await setToken(token);
    queryClient.clear();
    setUser(u);
  }, []);

  const signOut = useCallback(async () => {
    await setToken(null);
    queryClient.clear();
    setUser(null);
  }, []);

  const updateMe = useCallback(async (patch: Record<string, any>) => {
    const u = await api<User>("/me", { method: "PUT", body: patch });
    setUser(u);
    queryClient.invalidateQueries();
    return u;
  }, []);

  const refresh = useCallback(async () => {
    setUser(await api<User>("/me"));
  }, []);

  const value = useMemo(
    () => ({ user, ready, signIn, signOut, updateMe, refresh, textScale: Number(user?.settings?.text_scale || 1) }),
    [user, ready, signIn, signOut, updateMe, refresh],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
