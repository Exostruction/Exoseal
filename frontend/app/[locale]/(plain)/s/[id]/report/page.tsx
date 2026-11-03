import { Accent } from "@/components/Accent";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ReportSecret } from "@/components/ReportSecret";
import { routing } from "@/i18n/routing";

export const metadata = { robots: { index: false, follow: false } };

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function ReportPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  if (!hasLocale(routing.locales, locale) || !GUID.test(id)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations("report");
  const contact = process.env.ABUSE_EMAIL; // zur Laufzeit gelesen (Seite ist dynamisch)
  return (
    <main id="main" className="center">
      <div className="panel reveal">
        <h1><Accent text={t("title")} /></h1>
        <p className="lead-s">{t("text")}</p>
        <ReportSecret id={id} />
        {contact && <p className="after"><small>{t("contact", { email: contact })}</small></p>}
      </div>
    </main>
  );
}
