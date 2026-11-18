import * as Linking from "expo-linking";

export const inviteUrl = (token: string) => Linking.createURL("/invite", { queryParams: { token } });

/** Accepts a full invitation link or a bare token. */
export function tokenFrom(text: string) {
  const m = text.match(/token=([A-Za-z0-9_-]+)/);
  return m ? m[1] : /^[A-Za-z0-9_-]{16,}$/.test(text.trim()) ? text.trim() : "";
}
