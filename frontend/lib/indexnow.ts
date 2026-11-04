import { createHash } from "node:crypto";
import { routing } from "@/i18n/routing";
import { livePages } from "@/lib/pages";
import { siteUrl } from "@/lib/site";

// IndexNow: Suchmaschinen (Bing, Yandex und andere) erfahren sofort, welche öffentlichen Seiten es gibt.
// Nur mit INDEXNOW=true, nur über https und nie für localhost. Gesendet werden ausschließlich die Adressen aus der Sitemap.
export const indexNowEnabled = () => process.env.INDEXNOW === "true" && siteUrl().startsWith("https://") && !/localhost|127\.0\.0\.1/.test(siteUrl());

// Der Schlüssel ist nicht geheim (er muss öffentlich abrufbar sein) und folgt aus der Adresse: stabil, ohne Einstellung, ohne Speicher.
export const indexNowKey = () => createHash("sha256").update(`exoseal-indexnow:${siteUrl()}`).digest("hex").slice(0, 32);

export async function submitIndexNow(): Promise<void> {
  if (!indexNowEnabled()) return;
  const base = siteUrl();
  const key = indexNowKey();
  const urlList = (await livePages()).flatMap((p) => routing.locales.map((l) => `${base}/${l}${p.path}`));
  // ponytail: Meldung bei jedem Start des Servers (also pro Update/Neustart), ohne Merken des letzten Stands.
  const res = await fetch("https://api.indexnow.org/IndexNow", {
    method: "POST",
    headers: { "content-type": "application/json; charset=utf-8" },
    body: JSON.stringify({ host: new URL(base).host, key, keyLocation: `${base}/${key}.txt`, urlList }),
    signal: AbortSignal.timeout(10_000),
  });
  console.log(`IndexNow: ${urlList.length} Adressen gemeldet (Antwort ${res.status})`);
}
