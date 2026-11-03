import { feedItems, feedLang } from "@/lib/feed";
import { siteUrl } from "@/lib/site";

export const dynamic = "force-dynamic";

// Dasselbe als JSON für Maschinen (zum Beispiel ein täglicher Abruf durch eine andere Webseite).
export function GET(req: Request) {
  const lang = feedLang(new URL(req.url).searchParams.get("lang"));
  return Response.json({ name: "ExoSeal", language: lang, home: `${siteUrl()}/${lang}`, items: feedItems(lang) }, { headers: { "cache-control": "public, max-age=3600" } });
}
