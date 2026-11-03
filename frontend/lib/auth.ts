import { redirect } from "next/navigation";

// Ohne Anmeldung geht es zur eigenen Anmeldeseite und danach genau dorthin zurück, wo man hin wollte.
export function toLogin(locale: string, path: string): never {
  redirect(`/${locale}/login?returnUrl=${encodeURIComponent(`/${locale}${path}`)}`);
}

// Nur Pfade auf dieser Seite zulassen, nie eine fremde Adresse.
export const safeReturn = (v: string | undefined, fallback: string) => (v && /^\/(?!\/)[^\\s]*$/.test(v) ? v : fallback);
