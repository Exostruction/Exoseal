import { MAKER } from "@/lib/site";

export type BlogPost = { title: string; url: string; summary: string; date: string; category: string; categories: string[]; cover?: string };

const FEED = `${MAKER.url}/feed.xml`;
export const BLOG_PAGE_MAX = 24;

const decode = (s: string) =>
  s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&amp;/g, "&")
    .trim();
const tag = (item: string, name: string) => item.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`))?.[1];
const attr = (item: string, name: string, a: string) => item.match(new RegExp(`<${name}\\b[^>]*\\b${a}="([^"]*)"`))?.[1];

// Nur Links und Bilder von der Herausgeber-Seite werden übernommen (kein fremder Inhalt, keine fremden Hosts).
const own = (u: string | undefined) => {
  try {
    const x = new URL(u ?? "");
    return x.protocol === "https:" && x.origin === MAKER.url ? x.toString() : undefined;
  } catch {
    return undefined;
  }
};

/**
 * Beiträge des Herausgeber-Blogs zu dieser Kategorie (Standard: "ExoSeal"). Der Abruf läuft auf dem Server, eine Stunde gecacht:
 * Besucher kontaktieren nie die andere Seite. Nur wenn BLOG_ENABLED=true gesetzt ist; sonst und bei jedem Fehler: leer.
 */
export async function getBlogPosts(limit = 3): Promise<BlogPost[]> {
  if (process.env.BLOG_ENABLED !== "true") return [];
  const wanted = (process.env.BLOG_CATEGORY || "ExoSeal").trim().toLowerCase();
  try {
    const res = await fetch(FEED, { next: { revalidate: 3600 }, signal: AbortSignal.timeout(4000) });
    if (!res.ok) return [];
    const xml = (await res.text()).slice(0, 500_000);
    const items = xml.split("<item>").slice(1).map((s) => s.split("</item>")[0]);
    const out: BlogPost[] = [];
    for (const it of items) {
      const cats = [...it.matchAll(/<category[^>]*>([\s\S]*?)<\/category>/g)].map((m) => decode(m[1]));
      if (!cats.some((c) => c.toLowerCase() === wanted)) continue;
      const url = own(decode(tag(it, "link") ?? ""));
      const title = decode(tag(it, "title") ?? "");
      if (!url || !title) continue;
      const date = new Date(decode(tag(it, "pubDate") ?? ""));
      out.push({
        title,
        url,
        summary: decode(tag(it, "description") ?? ""),
        date: Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10),
        category: cats.find((c) => c.toLowerCase() !== wanted) ?? cats[0],
        categories: cats,
        cover: own(attr(it, "media:content", "url")),
      });
      if (out.length === limit) break;
    }
    return out;
  } catch {
    return [];
  }
}

/** Titelbild über den eigenen Bild-Dienst: Der Browser holt es von dieser Instanz, nicht von der anderen Seite. */
export const coverSrc = (cover: string, w: number) => `/_next/image?url=${encodeURIComponent(cover)}&w=${w}&q=75`;
