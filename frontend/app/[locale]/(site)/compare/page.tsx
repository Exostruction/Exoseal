import { Accent } from "@/components/Accent";
import { hasLocale, type Locale } from "next-intl";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { pageMeta } from "@/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "pages.compare" });
  return pageMeta(locale, "/compare", t("metaTitle"), t("metaDescription"));
}

const COLS = ["mail", "pm", "native", "exo"] as const;
const ROWS = ["a", "b", "c", "d", "e"] as const;
const BETTER = ["a", "b", "c"] as const;

export default async function ComparePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations("pages.compare");
  return (
    <main id="main">
      <div className="cs-head">
        <span className="eyebrow">{t("eyebrow")}</span>
        <h1><Accent text={t("title")} /></h1>
        <p>{t("intro")}</p>
      </div>
      <div className="cmp-wrap">
        <table className="cmp">
          <thead>
            <tr>
              <th scope="col"><span className="sr-only">{t("eyebrow")}</span></th>
              {COLS.map((c) => <th key={c} scope="col" className={c === "exo" ? "exo" : undefined}>{t(`cols.${c}`)}</th>)}
            </tr>
          </thead>
          <tbody>
            {ROWS.map((r) => (
              <tr key={r}>
                <th scope="row">{t(`rows.${r}.name`)}</th>
                {COLS.map((c) => <td key={c} className={c === "exo" ? "exo" : undefined}>{t(`rows.${r}.${c}`)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="cs-head sp-gap">
        <h2><Accent text={t("betterTitle")} /></h2>
        <p>{t("betterIntro")}</p>
      </div>
      <div className="lm">
        {BETTER.map((k, n) => (
          <div key={k}>
            <h3><span className="n" aria-hidden="true">{String(n + 1).padStart(2, "0")}</span>{t(`better.${k}.name`)}</h3>
            <p>{t(`better.${k}.text`)}</p>
          </div>
        ))}
      </div>
      <section className="cta-card" aria-labelledby="cmp-cta">
        <div>
          <h2 id="cmp-cta">{t("ctaTitle")}</h2>
          <p>{t("ctaText")}</p>
        </div>
        <div className="cta-actions">
          <Link href="/security" className="btn primary">{t("ctaSecurity")}</Link>
          <Link href="/guides" className="btn">{t("ctaGuides")}</Link>
        </div>
      </section>
    </main>
  );
}
