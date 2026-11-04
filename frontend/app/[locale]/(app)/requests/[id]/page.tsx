import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { Msg } from "@/components/Msg";
import { DeleteRequest } from "@/components/DeleteRequest";
import { OpenResponse } from "@/components/OpenResponse";
import { TooMany } from "@/components/TooMany";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { toLogin } from "@/lib/auth";
import { backendFetch } from "@/lib/backend";

export const metadata = { robots: { index: false }, referrer: "no-referrer" as const };

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type Detail = { id: string; question: string; status: "open" | "answered" | "consumed" | "expired"; createdAt: string; expiresAt: string; answeredAt: string | null };

export default async function RequestDetailPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  if (!hasLocale(routing.locales, locale) || !GUID.test(id)) notFound();
  setRequestLocale(locale);
  const [t, format] = await Promise.all([getTranslations("requests"), getFormatter()]);

  const res = await backendFetch(`/requests/${id}`);
  if (res.status === 401) toLogin(locale, `/requests/${id}`);
  if (res.status === 404) notFound(); // gibt es nicht oder gehört jemand anderem: nicht unterscheidbar
  if (res.status === 429) return <TooMany />;
  if (!res.ok) throw new Error("request failed");
  const r = (await res.json()) as Detail;
  const when = (iso: string) => format.dateTime(new Date(iso), { dateStyle: "medium", timeStyle: "short" });

  return (
    <main id="main">
      <p className="back"><Link href="/requests">← {t("detail.back")}</Link></p>
      <h1>{r.question}</h1>
      <p><span className={`st ${r.status}`}><strong>{t(`status.${r.status}`)}</strong></span>: {t(`detail.statusText.${r.status}`)}</p>
      <dl>
        <dt>{t("detail.created")}</dt><dd>{when(r.createdAt)}</dd>
        <dt>{t("detail.expires")}</dt><dd>{when(r.expiresAt)}</dd>
        {r.answeredAt && <><dt>{t("detail.answered")}</dt><dd>{when(r.answeredAt)}</dd></>}
      </dl>
      {r.status === "open" && <Msg kind="info">{t("detail.linkNote")}</Msg>}
      {r.status === "answered" && <OpenResponse id={r.id} />}
      <DeleteRequest id={r.id} />
    </main>
  );
}
