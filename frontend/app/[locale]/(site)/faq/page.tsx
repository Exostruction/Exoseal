import { ArrowRight } from "lucide-react";
import { Accent } from "@/components/Accent";
import { hasLocale, type Locale } from "next-intl";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { FaqBrowser } from "@/components/FaqBrowser";
import { JsonLd } from "@/components/JsonLd";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { pageMeta } from "@/lib/seo";
import { MAKER, siteUrl } from "@/lib/site";

const CAT = { q1: "security", q2: "security", q7: "security", q10: "security", q4: "privacy", q11: "privacy", q3: "usage", q5: "usage", q8: "usage", q9: "usage", q12: "usage", q6: "operation" } as const;
const ALL = ["q1", "q2", "q3", "q4", "q5", "q6", "q7", "q8", "q9", "q10", "q11", "q12"] as const;

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  const l = await getTranslations({ locale, namespace: "landing" });
  return pageMeta(locale, "/faq", l("meta.faq.title"), l("meta.faq.description"));
}

export default async function FaqPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const l = await getTranslations("landing");
  const ld = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "FAQPage",
        url: `${siteUrl()}/${locale}/faq`,
        inLanguage: locale,
        publisher: { "@type": "Organization", name: MAKER.name, url: MAKER.url },
        mainEntity: ALL.map((q) => ({ "@type": "Question", name: l(`faq.${q}.q`), acceptedAnswer: { "@type": "Answer", text: l(`faq.${q}.a`) } })),
      },
    ],
  };
  return (
    <main id="main">
      <JsonLd data={ld} />
      <div className="cs-head">
        <span className="eyebrow">{l("faqPage.eyebrow")}</span>
        <h1><Accent text={l("faqPage.title")} /></h1>
        <p>{l("faqPage.intro")}</p>
      </div>
      <FaqBrowser
        labels={{ search: l("faqPage.search"), all: l("faqPage.all"), empty: l("faqPage.empty"), count: l("faqPage.count") }}
        items={ALL.map((q) => ({ key: q, q: l(`faq.${q}.q`), a: l(`faq.${q}.a`), cat: l(`faqPage.cat.${CAT[q]}`) }))}
      />
      <section className="cta-card" aria-labelledby="faq-cta">
        <div>
          <h2 id="faq-cta">{l("faqPage.ctaTitle")}</h2>
          <p>{l("faqPage.ctaText")}</p>
        </div>
        <div className="cta-actions">
          <Link href="/login" className="btn primary">{l("faqPage.ctaLogin")}<ArrowRight size={16} aria-hidden="true" /></Link>
          <Link href="/guides" className="btn">{l("faqPage.ctaGuides")}</Link>
        </div>
      </section>
    </main>
  );
}
