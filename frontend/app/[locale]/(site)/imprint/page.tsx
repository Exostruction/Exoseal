import { Accent } from "@/components/Accent";
import { hasLocale, type Locale } from "next-intl";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { pageMeta } from "@/lib/seo";

// Angaben kommen vom Betreiber über Umgebungsvariablen (IMPRINT_NAME, IMPRINT_ADDRESS, IMPRINT_EMAIL), nicht aus dem Code.
export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "legal.imprint" });
  return pageMeta(locale, "/imprint", `${t("title")} | ExoSeal`, t("metaDescription"));
}

export default async function ImprintPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  await connection(); // zur Laufzeit rendern, damit die Variablen nicht beim Build eingebacken werden
  const t = await getTranslations("legal.imprint");
  const name = process.env.IMPRINT_NAME;
  const address = process.env.IMPRINT_ADDRESS;
  const email = process.env.IMPRINT_EMAIL;
  const env = process.env;
  const clean = (v?: string) => v?.replace(/\\n/g, "\n").trim() || "";
  const contact = [email, clean(env.IMPRINT_PHONE)].filter(Boolean).join("\n");
  const blocks = (
    [
      ["provider", [clean(name), clean(address)].filter(Boolean).join("\n")],
      ["representedBy", clean(env.IMPRINT_REPRESENTED_BY)],
      ["contact", contact],
      ["register", clean(env.IMPRINT_REGISTER)],
      ["vatId", clean(env.IMPRINT_VAT_ID)],
    ] as const
  ).filter(([, v]) => v);
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
      <div className="lg-body">
        {blocks.length ? (
          blocks.map(([k, content], n) => (
            <section key={k} id={k}>
              <h2><span className="n" aria-hidden="true">{String(n + 1).padStart(2, "0")}</span>{t(k)}</h2>
              <p className="lines">{content}</p>
            </section>
          ))
        ) : (
          <section><p>{t("unset")}</p></section>
        )}
      </div>
    </main>
  );
}
