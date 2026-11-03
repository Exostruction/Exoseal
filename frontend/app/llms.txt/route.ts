import { getTranslations } from "next-intl/server";
import { livePages } from "@/lib/pages";
import { MAKER, siteUrl } from "@/lib/site";

export const dynamic = "force-dynamic";

// Kurzbeschreibung für KI-Assistenten (llms.txt). Englisch, weil das die Konvention ist.
// Die Seitenliste baut sich aus lib/pages.ts selbst.
export async function GET() {
  const b = siteUrl();
  const [t, g] = await Promise.all([getTranslations({ locale: "en", namespace: "sitemap" }), getTranslations({ locale: "en", namespace: "guides" })]);
  const pages = (await livePages()).filter((p) => p.path !== "/sitemap")
    .map((p) => `- [${p.guide ? g(`items.${p.guide}.title`) : t(`links.${p.key as "start"}`)}](${b}/en${p.path})`)
    .join("\n");
  const body = `# ExoSeal

> ExoSeal is an open-source tool (AGPL-3.0) to share passwords, keys and other secrets as a one-time link. Secrets are encrypted end-to-end in the browser; the server only ever stores ciphertext and the key never leaves the link fragment (the part after #). Built by ${MAKER.name} (${MAKER.url}). Self-hostable with Docker.

## Key facts

- A secret link works exactly once and is deleted on first view or when it expires (1 minute to 7 days).
- Recipients never need an account. Senders sign in so strangers cannot use the server as a free relay.
- Optional extra password, shown to the recipient as a second step.
- Request mode: ask someone for a secret with a request link; they answer in their browser, you open the answer with your passphrase.
- No cookies for visitors, no analytics, no external resources, the application never stores or logs IP addresses.

## Pages (English; every page also exists in German under /de)

${pages}

## Maker

- [${MAKER.name}](${MAKER.url}): software company behind ExoSeal
`;
  return new Response(body, { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=3600" } });
}
