import { Accent } from "@/components/Accent";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { RevokeSecret } from "@/components/RevokeSecret";
import { RefreshButton } from "@/components/RefreshButton";
import { TooMany } from "@/components/TooMany";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { toLogin } from "@/lib/auth";
import { backendFetch } from "@/lib/backend";

export const metadata = { robots: { index: false }, referrer: "no-referrer" as const };

const PAGE_SIZE = 20;
type State = "available" | "opened" | "expired" | "reported" | "revoked";
type Item = { id: string; label: string | null; state: State; createdAt: string; expiresAt: string };
type PageData = { items: Item[]; total: number; page: number; pageSize: number };

// Die gesendeten Links des Nutzers samt Status. Inhalte und Empfänger kennt der Server nicht, es gibt nur ID, Bezeichnung, Zeiten und Status.
export default async function SentPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ page?: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const sp = await searchParams;
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);
  const [t, format] = await Promise.all([getTranslations("sent"), getFormatter()]);
  const res = await backendFetch(`/secrets/mine?page=${page}&pageSize=${PAGE_SIZE}`);
  if (res.status === 401) toLogin(locale, "/sent");
  if (res.status === 429) return <TooMany />;
  if (!res.ok) throw new Error("sent failed");
  const data = (await res.json()) as PageData;
  const pages = Math.max(1, Math.ceil(data.total / PAGE_SIZE));
  const when = (iso: string) => format.dateTime(new Date(iso), { dateStyle: "medium", timeStyle: "short" });
  return (
    <main id="main">
      <div className="page-head">
        <h1><Accent text={t("title")} /></h1>
        <div className="actions"><RefreshButton /><Link href="/new" className="btn primary">{t("newCta")}</Link></div>
      </div>
      <p className="count">{t("total", { total: data.total })}</p>
      {data.items.length === 0 ? (
        <p className="empty">{t("empty")}</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th scope="col">{t("columns.label")}</th>
              <th scope="col">{t("columns.status")}</th>
              <th scope="col">{t("columns.created")}</th>
              <th scope="col">{t("columns.expires")}</th>
              <th scope="col"><span className="sr-only">{t("columns.actions")}</span></th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((s) => (
              <tr key={s.id}>
                <td>{s.label ?? <span className="muted">{t("noLabel", { id: s.id.slice(0, 8) })}</span>}</td>
                <td><span className={`st ${s.state}`}>{t(`status.${s.state}`)}</span></td>
                <td>{when(s.createdAt)}</td>
                <td>{when(s.expiresAt)}</td>
                <td className="row-actions">{s.state === "available" && <RevokeSecret id={s.id} />}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="note-small">{t("note")}</p>
      {pages > 1 && (
        <nav className="pager" aria-label={t("page", { page, pages })}>
          {page > 1 && <Link href={{ pathname: "/sent", query: { page: page - 1 } }} rel="prev">{t("prev")}</Link>}{" "}
          <span>{t("page", { page, pages })}</span>{" "}
          {page < pages && <Link href={{ pathname: "/sent", query: { page: page + 1 } }} rel="next">{t("next")}</Link>}
        </nav>
      )}
    </main>
  );
}
