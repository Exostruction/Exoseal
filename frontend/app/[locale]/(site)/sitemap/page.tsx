import { Accent } from "@/components/Accent";
import { hasLocale, type Locale } from "next-intl";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { APP_PAGES, livePages, type Group } from "@/lib/pages";
import { pageMeta } from "@/lib/seo";

const ORDER: Group[] = ["product", "guides", "app", "legal"];

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "sitemap" });
  return pageMeta(locale, "/sitemap", t("metaTitle"), t("metaDescription"));
}

// Liest alles aus lib/pages.ts: neue Seiten und Anleitungen tauchen hier von selbst auf.
export default async function SitemapPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const [t, g] = await Promise.all([getTranslations("sitemap"), getTranslations("guides")]);
  const entries = [
    ...(await livePages()).map((p) => ({ path: p.path || "/", group: p.group, label: p.guide ? g(`items.${p.guide}.title`) : t(`links.${p.key as "start"}`) })),
    ...APP_PAGES.map((p) => ({ path: p.path, group: "app" as Group, label: t(`links.${p.key}`) })),
  ];
  return (
    <main id="main">
      <div className="cs-head">
        <h1><Accent text={t("title")} /></h1>
        <p>{t("intro")}</p>
      </div>
      <div className="smap">
        {ORDER.map((grp) => (
          <section key={grp}>
            <h2>{t(`groups.${grp}`)}</h2>
            <ul>
              {entries.filter((e) => e.group === grp).map((e) => <li key={e.path}><Link href={e.path as "/"}>{e.label}</Link></li>)}
            </ul>
          </section>
        ))}
      </div>
    </main>
  );
}
