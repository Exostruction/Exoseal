import { getBlogPosts } from "@/lib/blog";
import { GUIDE_SLUGS, type GuideSlug } from "@/lib/guides";

// Einzige Quelle für alle öffentlichen Seiten. sitemap.xml, die Seitenübersicht, llms.txt und robots.txt lesen alle hier.
// Neue Seite = hier eintragen (Anleitungen kommen von selbst aus den Texten dazu).
export type Group = "product" | "guides" | "app" | "legal";
export type PageEntry = { path: string; group: Group; key: string; priority: number; freq: "weekly" | "monthly"; guide?: GuideSlug };

export const PUBLIC_PAGES: PageEntry[] = [
  { path: "", group: "product", key: "start", priority: 1, freq: "weekly" },
  { path: "/faq", group: "product", key: "faq", priority: 0.8, freq: "monthly" },
  { path: "/guides", group: "guides", key: "guides", priority: 0.8, freq: "monthly" },
  ...GUIDE_SLUGS.map((slug): PageEntry => ({ path: `/guides/${slug}`, group: "guides", key: slug, priority: 0.8, freq: "monthly", guide: slug })),
  { path: "/security", group: "product", key: "security", priority: 0.9, freq: "monthly" },
  { path: "/compare", group: "product", key: "compare", priority: 0.8, freq: "monthly" },
  { path: "/open-source", group: "product", key: "openSource", priority: 0.7, freq: "monthly" },
  { path: "/changelog", group: "product", key: "changelog", priority: 0.6, freq: "weekly" },
  { path: "/sitemap", group: "product", key: "sitemap", priority: 0.3, freq: "monthly" },
  { path: "/privacy", group: "legal", key: "privacy", priority: 0.3, freq: "monthly" },
  { path: "/terms", group: "legal", key: "terms", priority: 0.3, freq: "monthly" },
  { path: "/imprint", group: "legal", key: "imprint", priority: 0.3, freq: "monthly" },
];

// Seiten der App: erreichbar, aber nicht für Suchmaschinen.
export const APP_PAGES = [
  { path: "/login", key: "login" },
] as const;

// Alles, was robots.txt sperrt (ohne Sprachpräfix).
export const CLOSED_PREFIXES = ["/s/", "/r/", "/new", "/requests", "/login"] as const;

/** Die Seitenliste, wie sie gerade gilt: Die Blog-Seite erscheint erst, wenn es Beiträge dafür gibt. */
export async function livePages(): Promise<PageEntry[]> {
  const hasBlog = (await getBlogPosts(1)).length > 0;
  return hasBlog ? [...PUBLIC_PAGES, { path: "/blog", group: "product", key: "blog", priority: 0.7, freq: "weekly" }] : PUBLIC_PAGES;
}
