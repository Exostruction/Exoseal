import { Accent } from "@/components/Accent";
import { GuideBrowser } from "@/components/GuideBrowser";
import { hasLocale, type Locale } from "next-intl";
import { notFound } from "next/navigation";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { JsonLd } from "@/components/JsonLd";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { GUIDE_SLUGS, type Guides } from "@/lib/guides";
import { pageMeta } from "@/lib/seo";
import { siteUrl } from "@/lib/site";

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "guides.index" });
  return pageMeta(locale, "/guides", t("metaTitle"), t("metaDescription"));
}

export default async function GuidesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const [t, c, g] = await Promise.all([getTranslations("guides.index"), getTranslations("guides.common"), getTranslations("guides")]);
  const base = siteUrl();
  const { guides } = (await getMessages()) as unknown as { guides: Guides };
  return (
    <main id="main" className="gx">
      <Breadcrumbs locale={locale} items={[{ name: c("home"), path: "/" }, { name: c("guides"), path: "/guides" }]} />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: t("title"),
          description: t("metaDescription"),
          inLanguage: locale,
          hasPart: GUIDE_SLUGS.map((s) => ({ "@type": "HowTo", name: g(`items.${s}.title`), url: `${base}/${locale}/guides/${s}` })),
        }}
      />
      <div className="cs-head">
        <span className="eyebrow">{t("eyebrow")}</span>
        <h1><Accent text={t("heading")} /></h1>
        <p>{t("intro")}</p>
      </div>
      <GuideBrowser
        labels={{ search: t("search"), all: t("all"), empty: t("empty"), eyebrow: t("eyebrow"), read: t("read") }}
        items={GUIDE_SLUGS.map((s) => ({
          slug: s,
          title: g(`items.${s}.title`),
          description: g(`items.${s}.description`),
          tag: g(`items.${s}.tag`),
          steps: t("steps", { n: Object.keys(guides.items[s].steps).length }),
        }))}
      />
    </main>
  );
}
