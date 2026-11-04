import { cookies } from "next/headers";
import { getLocale } from "next-intl/server";

export type Me = { sub: string; email?: string; name?: string };

/** Server-seitiger Backend-Aufruf: reicht Session-Cookie und gewählte Sprache (Accept-Language) durch. */
export async function backendFetch(path: string, init: RequestInit = {}) {
  return fetch(`${process.env.BACKEND_URL ?? "http://backend:8080"}${path}`, {
    ...init,
    cache: "no-store",
    headers: { ...init.headers, cookie: (await cookies()).toString(), "accept-language": await getLocale() },
  });
}

/** Eingeloggter Nutzer oder null. */
export async function getMe(): Promise<Me | null> {
  const res = await backendFetch("/me");
  return res.ok ? ((await res.json()) as Me) : null;
}
