import { useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useFocusEffect } from "expo-router";

import { queryClient } from "@/src/query-client";
import { storage } from "@/src/utils/storage";

const BASE = `${process.env.EXPO_PUBLIC_BACKEND_URL}/api`;
export const TOKEN_KEY = "amodo_token";
let token: string | null = null;

export async function loadToken() {
  token = (await storage.secureGet(TOKEN_KEY, null)) as string | null;
  return token;
}

export async function setToken(t: string | null) {
  token = t;
  if (t) await storage.secureSet(TOKEN_KEY, t);
  else await storage.secureRemove(TOKEN_KEY);
}

export function hasToken() {
  return !!token;
}

export async function api<T = any>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  let r: Response;
  try {
    r = await fetch(BASE + path, {
      method: opts.method || "GET",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
  } catch {
    throw new Error("Sin conexión. Revisa tu internet e intenta de nuevo.");
  }
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    const d = (data as any)?.detail;
    const err: any = new Error(typeof d === "string" ? d : Array.isArray(d) ? "Revisa los campos marcados." : "Algo no salió como esperábamos. Intenta de nuevo.");
    err.status = r.status;
    throw err;
  }
  return data as T;
}

/** GET helper with cache + refetch whenever the screen regains focus. */
export function useApi<T = any>(path: string | null) {
  const q = useQuery<T>({
    queryKey: [path],
    queryFn: () => api<T>(path as string),
    enabled: !!path,
    retry: (n, e: any) => !(e?.status >= 400 && e?.status < 500) && n < 2,
  });
  const { refetch } = q;
  useFocusEffect(
    useCallback(() => {
      if (path) refetch();
    }, [path, refetch]),
  );
  return q;
}

let afterInvalidate: (() => void) | null = null;
export function onInvalidate(fn: (() => void) | null) {
  afterInvalidate = fn;
}

export function invalidate() {
  afterInvalidate?.();
  return queryClient.invalidateQueries();
}

export function authHeader(): Record<string, string> {
  return token ? { Authorization: `Bearer ${token}` } : {};
}
export const API_BASE = BASE;
