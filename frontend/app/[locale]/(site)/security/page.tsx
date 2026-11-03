import { Accent } from "@/components/Accent";
import { Check, X } from "lucide-react";
import { hasLocale, type Locale } from "next-intl";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { pageMeta } from "@/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "pages.security" });
  return pageMeta(locale, "/security", t("metaTitle"), t("metaDescription"));
}

const ITEMS_YES = ["a", "b", "c", "d", "e", "f", "g", "h", "i"] as const;
const ITEMS_NO = ["a", "b", "c", "d", "e", "f", "g"] as const;
const VERIFY = ["a", "b", "c"] as const;

export default async function SecurityPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations("pages.security");
  return (
    <main id="main">
      <div className="cs-head">
        <span className="eyebrow">{t("eyebrow")}</span>
        <h1><Accent text={t("title")} /></h1>
        <p>{t("intro")}</p>
      </div>
      <div className="sg">
        <div className="see">
          <p className="sg-w">{t("yesWord")}</p>
          {ITEMS_YES.map((k) => (
            <p key={k} className="sg-i"><Check className="sg-m" size={20} strokeWidth={2.8} aria-hidden="true" /><span><b>{t(`yes.${k}.name`)}.</b> {t(`yes.${k}.text`)}</span></p>
          ))}
        </div>
        <div className="never">
          <p className="sg-w">{t("noWord")}</p>
          {ITEMS_NO.map((k) => (
            <p key={k} className="sg-i"><X className="sg-m" size={20} strokeWidth={2.8} aria-hidden="true" /><span><b>{t(`no.${k}.name`)}.</b> {t(`no.${k}.text`)}</span></p>
          ))}
        </div>
      </div>
      <div className="cs-head sp-gap">
        <h2><Accent text={t("verifyTitle")} /></h2>
        <p>{t("verifyIntro")}</p>
      </div>
      <div className="lm">
        {VERIFY.map((k, n) => (
          <div key={k}>
            <h3><span className="n" aria-hidden="true">{String(n + 1).padStart(2, "0")}</span>{t(`verify.${k}.name`)}</h3>
            <p>{t(`verify.${k}.text`)}</p>
          </div>
        ))}
      </div>
      <section className="cta-card" aria-labelledby="sec-cta">
        <div>
          <h2 id="sec-cta">{t("ctaTitle")}</h2>
          <p>{t("ctaText")}</p>
        </div>
        <div className="cta-actions">
          <Link href="/faq" className="btn primary">{t("ctaFaq")}</Link>
          <Link href="/guides/self-hosting" className="btn">{t("ctaHost")}</Link>
        </div>
      </section>
    </main>
  );
}
