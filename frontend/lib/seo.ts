import type { Metadata } from "next";
import { routing } from "@/i18n/routing";
import { MAKER, siteUrl } from "@/lib/site";

const OG_LOCALE: Record<string, string> = { de: "de_DE", en: "en_US" };

export function pageMeta(locale: string, path: string, title: string, description: string): Metadata {
  const base = siteUrl();
  const url = `${base}/${locale}${path}`;
  const image = { url: `${base}/${locale}/opengraph-image`, width: 1200, height: 630 };
  const languages: Record<string, string> = Object.fromEntries(routing.locales.map((l) => [l, `${base}/${l}${path}`]));
  languages["x-default"] = `${base}/${routing.defaultLocale}${path}`;
  return {
    title: { absolute: title },
    description,
    authors: [{ name: MAKER.name, url: MAKER.url }],
    creator: MAKER.name,
    publisher: MAKER.name,
    alternates: { canonical: url, languages, types: { "application/atom+xml": `${base}/feed.xml${locale === "de" ? "?lang=de" : ""}` } },
    openGraph: { type: "website", url, title, description, siteName: "ExoSeal", locale: OG_LOCALE[locale] ?? "en_US", alternateLocale: routing.locales.filter((l) => l !== locale).map((l) => OG_LOCALE[l]), images: [image] },
    twitter: { card: "summary_large_image", title, description, images: [image.url] },
  };
}
