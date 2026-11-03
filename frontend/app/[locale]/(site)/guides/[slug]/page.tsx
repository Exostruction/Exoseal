import { Accent } from "@/components/Accent";
import { FaqAccordion } from "@/components/FaqList";
import { GuideCard } from "@/components/GuideCard";
import { LogoMark } from "@/components/Logo";
import makerMark from "@/assets/exostruction-mark.png";
import { ArrowLeft, ArrowRight, ArrowUpRight, Check } from "lucide-react";
import { hasLocale, type Locale } from "next-intl";
import { notFound } from "next/navigation";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { JsonLd } from "@/components/JsonLd";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { GUIDE_SLUGS, isGuide, type Guides } from "@/lib/guides";
import { pageMeta } from "@/lib/seo";
import { MAKER, siteUrl } from "@/lib/site";

const CTA_HREF = { ctaSend: "/login", ctaRequest: "/login", ctaFaq: "/faq" } as const;

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale; slug: string }> }) {
  const { locale, slug } = await params;
  if (!isGuide(slug)) return {};
  const g = await getTranslations({ locale, namespace: "guides" });
  return pageMeta(locale, `/guides/${slug}`, g(`items.${slug}.metaTitle`), g(`items.${slug}.description`));
}

export default async function GuidePage({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params;
  if (!hasLocale(routing.locales, locale) || !isGuide(slug)) notFound();
  setRequestLocale(locale);
  const [{ guides }, c, ix] = await Promise.all([getMessages() as unknown as Promise<{ guides: Guides }>, getTranslations("guides.common"), getTranslations("guides.index")]);
  const guide = guides.items[slug];
  const steps = Object.entries(guide.steps) as [string, { title: string; text: string }][];
  const tips = Object.values(guide.tips) as string[];
  const cta = guide.cta as keyof typeof CTA_HREF;
  const base = siteUrl();
  const url = `${base}/${locale}/guides/${slug}`;
  const faq = Object.values(guide.faq) as { q: string; a: string }[];
  const words = [guide.intro, ...steps.map(([, s]) => `${s.title} ${s.text}`), ...tips, ...faq.map((f) => `${f.q} ${f.a}`)].join(" ").split(/\s+/).length;
  const minutes = Math.max(1, Math.ceil(words / 180));
  const others = GUIDE_SLUGS.filter((s) => s !== slug);
  return (
    <main id="main" className="gx">
      <Breadcrumbs locale={locale} items={[{ name: c("home"), path: "/" }, { name: c("guides"), path: "/guides" }, { name: guide.title, path: `/guides/${slug}` }]} />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "HowTo",
          name: guide.title,
          description: guide.description,
          inLanguage: locale,
          url,
          author: { "@type": "Organization", name: MAKER.name, url: MAKER.url },
          step: steps.map(([k, s], i) => ({ "@type": "HowToStep", position: i + 1, name: s.title, text: s.text, url: `${url}#${k}` })),
        }}
      />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "FAQPage",
          inLanguage: locale,
          mainEntity: faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
        }}
      />
      <article className="ga">
        <div className="ga-main">
          <Link href="/guides" className="ga-back"><ArrowLeft size={16} aria-hidden="true" />{c("back")}</Link>
          <p className="ga-meta"><span>{MAKER.name}</span><span aria-hidden="true">·</span><time dateTime={guide.updated}>{guide.updated}</time><span aria-hidden="true">·</span><span>{c("readTime", { n: minutes })}</span></p>
          <h1><Accent text={guide.title} /></h1>
          <p className="ga-lead">{guide.intro}</p>
          <span className="chip">{guide.tag}</span>
          <nav className="ga-toc" aria-label={c("toc")}>
            <p className="eyebrow">{c("toc")}</p>
            <ol>
              {steps.map(([k, s], i) => <li key={k}><a href={`#${k}`}><span>{String(i + 1).padStart(2, "0")}</span>{s.title}</a></li>)}
            </ol>
          </nav>
          <div className="ga-banner" aria-hidden="true">
            <small>{guide.tag}</small>
            <b>{guide.title}</b>
            <span>{guide.description}</span>
            <i>{MAKER.name}</i>
            <LogoMark size={34} />
          </div>
          <div className="ga-prose">
            {steps.map(([k, s]) => (
              <section key={k} id={k}>
                <h2>{s.title}</h2>
                <p>{s.text}</p>
              </section>
            ))}
          </div>
          <section className="gtips" aria-labelledby="tips-h">
            <h2 id="tips-h"><Accent text={c("tips")} /></h2>
            <ul className="ga-bullets">
              {tips.map((x) => <li key={x}>{x}</li>)}
            </ul>
          </section>
          <section className="gfaq" aria-labelledby="gfaq-h">
            <h2 id="gfaq-h"><Accent text={c("faqTitle")} /></h2>
            <FaqAccordion items={faq} />
          </section>
          <section className="ga-author" aria-labelledby="ga-author-h">
            <p className="eyebrow" id="ga-author-h">{c("authorEyebrow")}</p>
            <a href={MAKER.url} rel="noopener">
              {/* eslint-disable-next-line @next/next/no-img-element -- next/image setzt ein Inline-Style, das unsere CSP blockiert */}
              <img src={makerMark.src} alt="" width={48} height={48} className="ga-avatar" />
              <span>
                <b>{MAKER.name}</b>
                <small>{c("authorRole")}</small>
                <span>{c("authorText")}</span>
              </span>
              <ArrowUpRight size={18} aria-hidden="true" />
            </a>
          </section>
          <p className="ga-note">{c("note")}</p>
        </div>
        <aside className="ga-side">
          <div className="ga-card">
            <p className="eyebrow">{c("sideEyebrow")}</p>
            <h2>{c("sideTitle")}</h2>
            <p>{c("sideText")}</p>
            <ul className="ga-facts">
              {(["factA", "factB", "factC"] as const).map((k) => <li key={k}><Check size={18} strokeWidth={2.5} aria-hidden="true" />{c(k)}</li>)}
            </ul>
            <Link href={CTA_HREF[cta]} className="btn primary">{c(cta)}</Link>
            <Link href="/faq" className="ga-card-link">{c("sideFaq")} →</Link>
          </div>
        </aside>
      </article>
      <section className="gread" aria-labelledby="gread-h">
        <div className="gread-head">
          <h2 id="gread-h">{c("readMore")}</h2>
          <Link href="/guides">{c("allGuides")} →</Link>
        </div>
        <ul className="gc">
          {others.map((o) => (
            <GuideCard
              key={o}
              item={{ slug: o, title: guides.items[o].title, description: guides.items[o].description, tag: guides.items[o].tag, steps: ix("steps", { n: Object.keys(guides.items[o].steps).length }) }}
              eyebrow={ix("eyebrow")}
              read={ix("read")}
            />
          ))}
        </ul>
      </section>
    </main>
  );
}
