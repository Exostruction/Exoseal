import { esc, feedItems, feedLang } from "@/lib/feed";
import { siteUrl } from "@/lib/site";

export const dynamic = "force-dynamic";

// Öffentlicher Atom-Feed (Änderungen und Anleitungen). Andere Seiten können ihn täglich abrufen, ?lang=de für Deutsch.
export function GET(req: Request) {
  const lang = feedLang(new URL(req.url).searchParams.get("lang"));
  const base = siteUrl();
  const items = feedItems(lang);
  const updated = items[0]?.date ?? "2026-11-02";
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xml:lang="${lang}">
  <title>ExoSeal</title>
  <id>${base}/${lang}</id>
  <link href="${base}/${lang}/changelog"/>
  <link rel="self" href="${base}/feed.xml${lang === "de" ? "?lang=de" : ""}"/>
  <updated>${updated}T00:00:00Z</updated>
  <author><name>Exostruction</name><uri>https://exostruction.com</uri></author>
${items.map((i) => `  <entry>
    <title>${esc(i.title)}</title>
    <id>${esc(i.id)}</id>
    <link href="${esc(i.url)}"/>
    <updated>${i.date}T00:00:00Z</updated>
    <summary>${esc(i.summary)}</summary>
  </entry>`).join("\n")}
</feed>
`;
  return new Response(body, { headers: { "content-type": "application/atom+xml; charset=utf-8", "cache-control": "public, max-age=3600" } });
}
