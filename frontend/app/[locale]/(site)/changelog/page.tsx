import { Accent } from "@/components/Accent";
import { Rss } from "lucide-react";
import { hasLocale, type Locale } from "next-intl";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import pkg from "../../../../package.json";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { pageMeta } from "@/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "pages.changelog" });
  return pageMeta(locale, "/changelog", t("metaTitle"), t("metaDescription"));
}

const ITEMS = ["e7", "e6", "e5", "e4", "e3", "e2", "e1"] as const;

export default async function ChangelogPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations("pages.changelog");
  const q = locale === "de" ? "?lang=de" : "";
  return (
    <main id="main">
      <div className="cs-head">
        <span className="eyebrow">{t("eyebrow")}</span>
        <h1><Accent text={t("title")} /></h1>
        <p>{t("intro")}</p>
      </div>
      <p className="cl-ver">{t("current")}: <code>v{pkg.version}</code></p>
      <p className="pf-links cl-feeds">
        <a href={`/feed.xml${q}`}><Rss size={16} aria-hidden="true" />{t("feed")}</a>
        <a href={`/changelog.json${q}`}>{t("json")}</a>
      </p>
      <ol className="cl">
        {ITEMS.map((k) => (
          <li key={k}>
            <div className="cl-meta">
              <span className="cl-v">v{t(`items.${k}.version`)}</span>
              <time dateTime={t(`items.${k}.date`)}>{t(`items.${k}.date`)}</time>
            </div>
            <div>
              <h2>{t(`items.${k}.title`)}</h2>
              <p>{t(`items.${k}.text`)}</p>
            </div>
          </li>
        ))}
      </ol>
    </main>
  );
}
