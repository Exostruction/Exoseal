import { ArrowUpRight } from "lucide-react";
import { Accent } from "@/components/Accent";
import { hasLocale, type Locale } from "next-intl";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { BlogBrowser } from "@/components/BlogBrowser";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { JsonLd } from "@/components/JsonLd";
import { routing } from "@/i18n/routing";
import { BLOG_PAGE_MAX, getBlogPosts } from "@/lib/blog";
import { pageMeta } from "@/lib/seo";
import { MAKER, siteUrl } from "@/lib/site";

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  const [t, posts] = await Promise.all([getTranslations({ locale, namespace: "landing.blogPage" }), getBlogPosts(1)]);
  // Ohne Beiträge nicht in Suchmaschinen: Eine leere Seite soll nicht im Index landen.
  return { ...pageMeta(locale, "/blog", t("metaTitle"), t("metaDescription")), ...(posts.length ? {} : { robots: { index: false, follow: true } }) };
}

// Die Beiträge liegen beim Herausgeber. Diese Seite listet nur die zu ExoSeal (Kategorie BLOG_CATEGORY) und verlinkt dorthin: kein kopierter Inhalt.
export default async function BlogPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const [t, c, format, posts] = await Promise.all([getTranslations("landing.blogPage"), getTranslations("guides.common"), getFormatter(), getBlogPosts(BLOG_PAGE_MAX)]);
  const cards = posts.map((p) => ({ ...p, dateLabel: p.date ? format.dateTime(new Date(p.date), { dateStyle: "medium" }) : "" }));
  const wanted = (process.env.BLOG_CATEGORY || "ExoSeal").trim();
  const base = siteUrl();
  return (
    <main id="main" className="gx">
      <Breadcrumbs locale={locale} items={[{ name: c("home"), path: "/" }, { name: t("eyebrow"), path: "/blog" }]} />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: t("title"),
          description: t("metaDescription"),
          inLanguage: locale,
          url: `${base}/${locale}/blog`,
          publisher: { "@type": "Organization", name: MAKER.name, url: MAKER.url },
          mainEntity: { "@type": "ItemList", itemListElement: posts.map((p, i) => ({ "@type": "ListItem", position: i + 1, url: p.url, name: p.title })) },
        }}
      />
      <div className="cs-head">
        <span className="eyebrow">{t("eyebrow")}</span>
        <h1><Accent text={t("title")} /></h1>
        <p>{t("intro")}{locale !== "de" && <> {t("german")}</>}</p>
      </div>
      {cards.length === 0 ? (
        <p className="gb-empty">{t("empty")}</p>
      ) : (
        <BlogBrowser posts={cards} wanted={wanted} labels={{ search: t("search"), all: t("allCategories"), empty: t("noMatch"), read: t("read"), count: t("count") }} />
      )}
      <p className="pf-links"><a href={`${MAKER.url}/blog`} rel="noopener">{t("outbound")} <ArrowUpRight size={16} aria-hidden="true" /></a></p>
    </main>
  );
}
