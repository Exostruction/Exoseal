import { Logo } from "@/components/Logo";
import { Accent } from "@/components/Accent";
import { ArrowRight, ArrowUpRight, Check, Container, Cookie, EyeOff, Flame, GitBranch, Hash, LockKeyhole, X } from "lucide-react";
import { hasLocale, type Locale } from "next-intl";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { BlogPosts } from "@/components/BlogPosts";
import { FaqList } from "@/components/FaqList";
import { GithubStars } from "@/components/GithubStars";
import { HeroStage } from "@/components/HeroStage";
import { HowScroll } from "@/components/HowScroll";
import { RequestIcon, SendIcon } from "@/components/ModeIcons";
import { JsonLd } from "@/components/JsonLd";
import { UseCases } from "@/components/UseCases";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { getMe } from "@/lib/backend";
import { pageMeta } from "@/lib/seo";
import { MAKER, githubRepo, siteUrl } from "@/lib/site";

const TICKER = [["a", LockKeyhole], ["b", Hash], ["c", Flame], ["d", Cookie], ["e", EyeOff], ["f", GitBranch], ["g", Container]] as const;
const COMPARE = ["a", "b", "c", "d", "e", "f"] as const;
const STEPS = ["one", "two", "three"] as const;
const POINTS = ["a", "b", "c"] as const;
const CASES = ["a", "b", "c", "d"] as const;
const ROLES = ["you", "link", "other"] as const;
const SIDE = ["a", "b", "c", "d"] as const;
const PROOF = ["a", "b", "c", "d"] as const;
const LIMITS = ["a", "b", "c", "d"] as const;
const ANAT = [["host", "urlHost"], ["id", "urlId"], ["key", "urlKey"]] as const;
const FAQ = ["q1", "q2", "q3", "q4", "q5", "q6"] as const;

const once = (c: React.ReactNode) => <em className="once">{c}</em>;

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  const l = await getTranslations({ locale, namespace: "landing" });
  return pageMeta(locale, "", l("meta.home.title"), l("meta.home.description"));
}

export default async function Home({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ error?: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const [me, { error }, c, t, l] = await Promise.all([getMe(), searchParams, getTranslations("common"), getTranslations("auth"), getTranslations("landing")]);
  const known = error === "forbidden" || error === "login";
  const base = siteUrl();
  const maker = { "@type": "Organization", "@id": `${MAKER.url}/#organization`, name: MAKER.name, url: MAKER.url };
  const repo = githubRepo();
  const ld = {
    "@context": "https://schema.org",
    "@graph": [
      maker,
      { "@type": "WebSite", "@id": `${base}/#website`, name: "ExoSeal", url: `${base}/${locale}`, inLanguage: locale, publisher: { "@id": maker["@id"] } },
      {
        "@type": "SoftwareApplication",
        "@id": `${base}/#software`,
        name: "ExoSeal",
        description: l("meta.home.description"),
        url: `${base}/${locale}`,
        image: `${base}/${locale}/opengraph-image`,
        inLanguage: locale,
        applicationCategory: "SecurityApplication",
        operatingSystem: "Web",
        isAccessibleForFree: true,
        license: "https://www.gnu.org/licenses/agpl-3.0.html",
        offers: { "@type": "Offer", price: "0", priceCurrency: "EUR" },
        author: { "@id": maker["@id"] },
        publisher: { "@id": maker["@id"] },
        ...(repo ? { codeRepository: `https://github.com/${repo}`, sameAs: [`https://github.com/${repo}`] } : {}),
      },
      {
        "@type": "HowTo",
        name: l("how.title"),
        description: l("how.intro"),
        step: STEPS.map((s, i) => ({ "@type": "HowToStep", position: i + 1, name: l(`how.${s}.title`), text: l(`how.${s}.text`) })),
      },
      {
        "@type": "FAQPage",
        mainEntity: FAQ.map((q) => ({ "@type": "Question", name: l(`faq.${q}.q`), acceptedAnswer: { "@type": "Answer", text: l(`faq.${q}.a`) } })),
      },
    ],
  };
  return (
    <main id="main" className="bare">
      <JsonLd data={ld} />
      <section className="hero">
        <div className="hero-in">
          <span className="eyebrow"><LockKeyhole size={14} />{l("eyebrow")}</span>
          <h1>{l.rich("title", { once })}</h1>
          <p className="lead">{l("lead")}</p>
          {known && <p role="alert">{t(`errors.${error}`)}</p>}
          {me ? (
            <>
              <div className="actions">
                <Link href="/new" className="btn primary big">{c("createCta")}</Link>
                <Link href="/requests/new" className="btn big">{l("secondary")}</Link>
                <Link href="/requests" className="btn big">{c("requestsCta")}</Link>
              </div>
              <form method="post" action="/api/v1/auth/logout" className="who">
                {t("signedInAs", { user: me.email ?? me.name ?? me.sub })} · <button type="submit">{t("logout")}</button>
              </form>
            </>
          ) : (
            <>
              <div className="actions">
                <Link href="/guides/self-hosting" className="btn primary big">{l("hero.selfHost")}</Link>
                <a href="#how" className="btn big">{c("nav.menu.how.title")}</a>
              </div>
              <p className="note">{l("signInNote")}</p>
            </>
          )}
        </div>
        <HeroStage />
      </section>

      <div className="ticker" aria-hidden="true">
        <div className="ticker-track">
          {[0, 1].map((n) => TICKER.map(([k, Icon]) => <span key={`${n}${k}`}><Icon size={18} strokeWidth={1.75} />{l(`ticker.${k}`)}</span>))}
        </div>
      </div>

      <section className="sec" id="why">
        <div className="sec-in">
          <div className="cs-head">
            <span className="eyebrow">{l("why.eyebrow")}</span>
            <h2><Accent text={l("why.title")} /></h2>
            <p>{l("why.intro")}</p>
          </div>
          <div className="why-cmp">
            <div className="why-bad">
              <h3>{l("why.badTitle")}</h3>
              <ul>
                {COMPARE.map((r) => (
                  <li key={r}>
                    <X size={18} strokeWidth={2} aria-hidden="true" />
                    <div>
                      <small>{l(`why.compare.rows.${r}.name`)}</small>
                      {l(`why.compare.rows.${r}.bad`)}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
            <div className="why-good">
              <h3><Logo height={40} title={l("why.goodTitle")} /></h3>
              <ul>
                {COMPARE.map((r) => (
                  <li key={r}>
                    <Check size={18} strokeWidth={2.25} aria-hidden="true" />
                    <div>
                      <small>{l(`why.compare.rows.${r}.name`)}</small>
                      {l(`why.compare.rows.${r}.good`)}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className="sec spots" id="how">
        <div className="sec-in">
          <HowScroll
            eyebrow={l("how.title")}
            title={l("how.intro")}
            lead={l("how.lead")}
            items={STEPS.map((s, i) => ({
              label: l("how.step", { n: i + 1 }),
              title: l(`how.${s}.title`),
              text: l(`how.${s}.text`),
              more: l(`how.${s}.more`),
              points: POINTS.map((k) => l(`how.${s}.points.${k}`)),
            }))}
          />
        </div>
      </section>

      <section className="sec">
        <div className="sec-in">
          <div className="cs-head">
            <span className="eyebrow"><Hash size={14} />{l("principle.eyebrow")}</span>
            <h2>{l.rich("principle.title", { once })}</h2>
            <p>{l("principle.text")}</p>
          </div>
          <ul className="br">
            {ANAT.map(([k, u]) => (
              <li key={k} className={`b-${k}`}>
                <code>{l(`principle.${u}`)}</code>
                <span className="br-t"><b>{l(`principle.${k}.label`)}</b>{l(`principle.${k}.text`)}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="sec spots">
        <div className="sec-in">
          <UseCases
            eyebrow={l("useCases.eyebrow")}
            title={l("useCases.title")}
            intro={l("useCases.intro")}
            more={l("useCases.introMore")}
            items={CASES.map((k) => ({
              title: l(`useCases.${k}.title`),
              text: l(`useCases.${k}.text`),
              steps: ROLES.map((r) => ({ role: l(`useCases.roles.${r}`), text: l(`useCases.${k}.steps.${r}`) })),
            }))}
          />
        </div>
      </section>

      <section className="sec">
        <div className="sec-in">
          <div className="cs-head">
            <h2><Accent text={l("modes.title")} /></h2>
            <p>{l("modes.intro")}</p>
          </div>
          <div className="md">
            <div className="md-a">
              <SendIcon className="md-ico" />
              <div className="md-t">
                <h3>{l("modes.send.title")}</h3>
                <p>{l("modes.send.text")}</p>
                <Link href="/login" className="btn primary">{l("modes.send.cta")}</Link>
              </div>
            </div>
            <div className="md-b">
              <RequestIcon className="md-ico" />
              <div className="md-t">
                <h3>{l("modes.request.title")}</h3>
                <p>{l("modes.request.text")}</p>
                <Link href="/login" className="btn primary">{l("modes.request.cta")}</Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="sec spots" id="security">
        <div className="sec-in">
          <div className="head-r">
            <span className="eyebrow">{l("security.eyebrow")}</span>
            <h2><Accent text={l("security.title")} /></h2>
            <p className="lead">{l("security.intro")}</p>
            <p>{l("security.note")}</p>
          </div>
          <div className="sg">
            {(["see", "never"] as const).map((g) => (
              <div key={g} className={g}>
                <p className="sg-w">{l(`security.${g}.word`)}</p>
                {SIDE.map((k) => (
                  <p key={k} className="sg-i">
                    {g === "see" ? <Check className="sg-m" size={20} strokeWidth={2.8} aria-hidden="true" /> : <X className="sg-m" size={20} strokeWidth={2.8} aria-hidden="true" />}
                    <span><b>{l(`security.${g}.${k}.name`)}.</b> {l(`security.${g}.${k}.text`)}</span>
                  </p>
                ))}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="sec">
        <div className="sec-in">
          <div className="cs-head">
            <span className="eyebrow">{l("limits.eyebrow")}</span>
            <h2><Accent text={l("limits.title")} /></h2>
            <p>{l("limits.intro")}</p>
          </div>
          <div className="lm">
            {LIMITS.map((k, n) => (
              <div key={k}>
                <h3><span className="n" aria-hidden="true">{String(n + 1).padStart(2, "0")}</span>{l(`limits.${k}.title`)}</h3>
                <p>{l(`limits.${k}.text`)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="sec" id="proof">
        <div className="sec-in">
          <div className="cs-head">
            <span className="eyebrow">{l("proof.eyebrow")}</span>
            <h2><Accent text={l("proof.title")} /></h2>
            <p>{l("proof.intro")}</p>
          </div>
          <div className="pf">
            {PROOF.map((k) => (
              <div key={k}>
                <b>{l(`proof.${k}.n`)}</b>
                <span>{l(`proof.${k}.label`)}</span>
              </div>
            ))}
          </div>
          <p className="pf-links">
            {repo && <a href={`https://github.com/${repo}`} rel="noopener">{l("proof.code")} <ArrowUpRight size={16} aria-hidden="true" /></a>}
            <Link href="/guides/self-hosting">{l("proof.host")} <ArrowRight size={16} aria-hidden="true" /></Link>
            <Link href="/#security">{l("proof.server")} <ArrowRight size={16} aria-hidden="true" /></Link>
          </p>
        </div>
      </section>

      <BlogPosts locale={locale} />

      <section className="sec spots" id="faq">
        <div className="sec-in">
          <div className="cs-head">
            <h2><Accent text={l("faq.title")} /></h2>
            <p>{l("faq.intro")}</p>
          </div>
          <FaqList keys={FAQ} />
          <p className="more"><Link href="/faq">{l("faqPage.title")} →</Link></p>
        </div>
      </section>

      <section className="band">
        <div className="band-in">
          <span className="band-ico"><Logo height={56} title="ExoSeal" /></span>
          <h2><Accent text={l("closing.title")} /></h2>
          <p>{l("closing.text")}</p>
          <div className="actions"><Link href="/guides/self-hosting" className="btn primary big">{l("closing.cta")}</Link><Link href="/login" className="btn big">{t("login")}</Link><GithubStars label={l("gh")} /></div>
        </div>
      </section>
    </main>
  );
}
