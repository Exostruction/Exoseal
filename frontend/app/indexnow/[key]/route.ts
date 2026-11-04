import { indexNowEnabled, indexNowKey } from "@/lib/indexnow";

export const dynamic = "force-dynamic";

// Schlüsseldatei für IndexNow, erreichbar als /<schlüssel>.txt (proxy.ts leitet dorthin um). Alles andere: 404.
export async function GET(_req: Request, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  if (!indexNowEnabled() || key !== indexNowKey()) return new Response("Not found", { status: 404 });
  return new Response(key, { headers: { "content-type": "text/plain; charset=utf-8" } });
}
