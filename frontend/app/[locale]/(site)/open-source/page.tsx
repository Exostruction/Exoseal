import { Accent } from "@/components/Accent";
import { ArrowUpRight } from "lucide-react";
import { hasLocale, type Locale } from "next-intl";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { pageMeta } from "@/lib/seo";
import { githubRepo } from "@/lib/site";

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "pages.openSource" });
  return pageMeta(locale, "/open-source", t("metaTitle"), t("metaDescription"));
}

const LIC = ["a", "b", "c"] as const;
const STACK = ["a", "b", "c"] as const;

export default async function OpenSourcePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations("pages.openSource");
  const repo = githubRepo();
  return (
    <main id="main">
      <div className="cs-head">
        <span className="eyebrow">{t("eyebrow")}</span>
        <h1><Accent text={t("title")} /></h1>
        <p>{t("intro")}</p>
      </div>
      <div className="cs-head sp-gap">
        <h2><Accent text={t("licenseTitle")} /></h2>
        <p>{t("licenseIntro")}</p>
      </div>
      <div className="lm">
        {LIC.map((k, n) => (
          <div key={k}>
            <h3><span className="n" aria-hidden="true">{String(n + 1).padStart(2, "0")}</span>{t(`license.${k}.name`)}</h3>
            <p>{t(`license.${k}.text`)}</p>
          </div>
        ))}
      </div>
      <div className="cs-head sp-gap">
        <h2><Accent text={t("stackTitle")} /></h2>
      </div>
      <div className="lm">
        {STACK.map((k, n) => (
          <div key={k}>
            <h3><span className="n" aria-hidden="true">{String(n + 1).padStart(2, "0")}</span>{t(`stack.${k}.name`)}</h3>
            <p>{t(`stack.${k}.text`)}</p>
          </div>
        ))}
      </div>
      <div className="cs-head sp-gap">
        <h2><Accent text={t("hostTitle")} /></h2>
        <p>{t("hostText")}</p>
      </div>
      <div className="cs-head">
        <h2><Accent text={t("joinTitle")} /></h2>
        <p>{t("joinText")}</p>
      </div>
      <p className="pf-links">
        {repo && <a href={`https://github.com/${repo}`} rel="noopener">{t("ctaCode")} <ArrowUpRight size={16} aria-hidden="true" /></a>}
        <Link href="/guides/self-hosting">{t("ctaHost")} →</Link>
        <Link href="/changelog">{t("ctaLog")} →</Link>
      </p>
    </main>
  );
}
