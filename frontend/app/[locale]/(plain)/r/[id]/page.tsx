import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { AnswerRequest } from "@/components/AnswerRequest";
import { routing } from "@/i18n/routing";

// Öffentliche Kunden-Seite: nicht indexieren, den Link (mit Fingerabdruck) nie als Referrer weitergeben.
export const metadata = { robots: { index: false, follow: false }, referrer: "no-referrer" as const };

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function AnswerPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  if (!hasLocale(routing.locales, locale) || !GUID.test(id)) notFound();
  setRequestLocale(locale);
  return (
    <main id="main" className="center">
      <div className="panel">
        <AnswerRequest id={id} />
      </div>
    </main>
  );
}
