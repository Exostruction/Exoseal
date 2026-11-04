import { Accent } from "@/components/Accent";
import { hasLocale, type Locale } from "next-intl";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { pageMeta } from "@/lib/seo";

const SECTIONS = ["scope", "service", "use", "access", "report", "availability", "liability", "changes", "law"] as const;

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "legal.terms" });
  return pageMeta(locale, "/terms", `${t("heading")} | ExoSeal`, t("metaDescription"));
}

// Der Betreiber (IMPRINT_NAME) wird zur Laufzeit eingesetzt, damit jede Instanz ihren eigenen Namen zeigt.
export default async function TermsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  await connection();
  const t = await getTranslations("legal.terms");
  const operator = process.env.IMPRINT_NAME?.trim() || t("operatorFallback");
  return (
    <main id="main">
      <div className="lg-head">
        <div>
          <span className="eyebrow">{t("eyebrow")}</span>
          <h1><Accent text={t("heading")} /></h1>
          <p>{t("intro")}</p>
        </div>
        <p className="lg-date"><small>{t("updatedLabel")}</small><b>{t("updated")}</b></p>
      </div>
      <nav className="lg-chips" aria-label={t("toc")}>
        {SECTIONS.map((s, n) => <a key={s} href={`#${s}`}><span>{String(n + 1).padStart(2, "0")}</span>{t(`${s}.title`)}</a>)}
      </nav>
      <div className="lg-body">
        {SECTIONS.map((s, n) => (
          <section key={s} id={s}>
            <h2><span className="n" aria-hidden="true">{String(n + 1).padStart(2, "0")}</span>{t(`${s}.title`)}</h2>
            <p>{t(`${s}.text`, { operator })}</p>
          </section>
        ))}
      </div>
    </main>
  );
}
