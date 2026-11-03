import type { MetadataRoute } from "next";
import { routing } from "@/i18n/routing";
import { livePages } from "@/lib/pages";
import { siteUrl } from "@/lib/site";

export const dynamic = "force-dynamic";

// Baut sich aus lib/pages.ts selbst: neue Seiten und Anleitungen erscheinen ohne weiteres Zutun.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  return (await livePages()).flatMap((p) =>
    routing.locales.map((l) => ({
      url: `${base}/${l}${p.path}`,
      changeFrequency: p.freq,
      priority: p.priority,
      alternates: { languages: { ...Object.fromEntries(routing.locales.map((x) => [x, `${base}/${x}${p.path}`])), "x-default": `${base}/${routing.defaultLocale}${p.path}` } },
    })),
  );
}
