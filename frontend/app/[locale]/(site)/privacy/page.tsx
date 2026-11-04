import { Accent } from "@/components/Accent";
import { hasLocale, type Locale } from "next-intl";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { pageMeta } from "@/lib/seo";

const SECTIONS = ["s1", "s2", "s3", "s4", "s5"] as const;
const KNOWN = ["cloudflare", "crowdsec", "crowdsecshare"] as const;

// PRIVACY_SERVICES (Komma-getrennt) nennt die Dienstleister dieser Instanz: cloudflare, crowdsec, crowdsecshare (CrowdSec mit Community-Teilen).
function services(): (typeof KNOWN)[number][] {
  const set = new Set((process.env.PRIVACY_SERVICES ?? "").split(",").map((s) => s.trim().toLowerCase()));
  if (set.has("crowdsecshare")) set.delete("crowdsec");
  return KNOWN.filter((k) => set.has(k));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "legal.privacy" });
  return pageMeta(locale, "/privacy", `${t("title")} | ExoSeal`, t("intro"));
}

export default async function PrivacyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  await connection(); // zur Laufzeit rendern: Die Dienstleister kommen aus der Umgebung
  const t = await getTranslations("legal.privacy");
  const used = services();
  return (
    <main id="main">
      <div className="lg-head">
        <div>
          <span className="eyebrow">{t("eyebrow")}</span>
          <h1>{t("heading")}</h1>
          <p>{t("intro")}</p>
        </div>
        <p className="lg-date"><small>{t("updatedLabel")}</small><b>{t("updated")}</b></p>
      </div>
      <nav className="lg-chips" aria-label={t("toc")}>
        {SECTIONS.map((s, n) => <a key={s} href={`#${s}`}><span>{String(n + 1).padStart(2, "0")}</span>{t(`${s}.title`)}</a>)}
        {used.length > 0 && <a href="#svc"><span>{String(SECTIONS.length + 1).padStart(2, "0")}</span>{t("services.title")}</a>}
      </nav>
      <div className="lg-body">
        {SECTIONS.map((s, n) => (
          <section key={s} id={s}>
            <h2><span className="n" aria-hidden="true">{String(n + 1).padStart(2, "0")}</span>{t(`${s}.title`)}</h2>
            <p>{t(`${s}.text`)}</p>
          </section>
        ))}
        {used.length > 0 && (
          <section id="svc">
            <h2><span className="n" aria-hidden="true">{String(SECTIONS.length + 1).padStart(2, "0")}</span>{t("services.title")}</h2>
            <p>{t("services.intro")}</p>
            {used.map((k) => (
              <p key={k}><b>{t(`services.${k}.title`)}.</b> {t(`services.${k}.text`)}</p>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}
