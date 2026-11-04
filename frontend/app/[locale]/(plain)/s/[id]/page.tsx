import { Accent } from "@/components/Accent";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { RevealSecret } from "@/components/RevealSecret";
import { routing } from "@/i18n/routing";

// Geheime Links nicht indexieren und den Link nie als Referrer weitergeben.
export const metadata = { robots: { index: false, follow: false }, referrer: "no-referrer" as const };

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function RevealPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  if (!hasLocale(routing.locales, locale) || !GUID.test(id)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations("reveal");
  return (
    <main id="main" className="center">
      <div className="panel">
        <h1><Accent text={t("title")} /></h1>
        <RevealSecret id={id} />
      </div>
    </main>
  );
}
