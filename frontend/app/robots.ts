import type { MetadataRoute } from "next";
import { routing } from "@/i18n/routing";
import { CLOSED_PREFIXES } from "@/lib/pages";
import { siteUrl } from "@/lib/site";

export const dynamic = "force-dynamic";

// Öffentliche Seiten sind offen für Suchmaschinen und KI-Assistenten. Geheimnis-Links, Anfragen und App bleiben draußen.
export default function robots(): MetadataRoute.Robots {
  // /login bleibt crawlbar: Die Seite ist überall verlinkt und trägt noindex, das Google nur lesen kann, wenn es sie abrufen darf.
  const closed = ["/api/", ...routing.locales.flatMap((l) => CLOSED_PREFIXES.filter((p) => p !== "/login").map((x) => `/${l}${x}`))];
  return { rules: [{ userAgent: "*", allow: "/", disallow: closed }], sitemap: `${siteUrl()}/sitemap.xml` };
}
