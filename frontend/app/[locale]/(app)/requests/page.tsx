import { Accent } from "@/components/Accent";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { RefreshButton } from "@/components/RefreshButton";
import { TooMany } from "@/components/TooMany";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { toLogin } from "@/lib/auth";
import { backendFetch } from "@/lib/backend";

export const metadata = { robots: { index: false }, referrer: "no-referrer" as const };

const STATUSES = ["all", "open", "answered", "consumed", "expired"] as const;
const SORTS = ["created_desc", "created_asc", "expires_asc", "expires_desc"] as const;
type Status = (typeof STATUSES)[number];
type Sort = (typeof SORTS)[number];
const PAGE_SIZE = 20;

type Item = { id: string; question: string; status: Exclude<Status, "all">; createdAt: string; expiresAt: string };
type PageData = { items: Item[]; total: number; page: number; pageSize: number };

// Nur bekannte Werte weitergeben; die eigentliche Filterung, Sortierung und Seitenbildung macht das Backend in der Datenbank.
const pick = <T extends string>(allowed: readonly T[], v: string | undefined, fallback: T): T => (allowed as readonly string[]).includes(v ?? "") ? (v as T) : fallback;

export default async function RequestsPage({ params, searchParams }: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ status?: string; sort?: string; page?: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const sp = await searchParams;
  const status = pick(STATUSES, sp.status, "all");
  const sort = pick(SORTS, sp.sort, "created_desc");
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);

  const [t, format] = await Promise.all([getTranslations("requests"), getFormatter()]);
  const res = await backendFetch(`/requests?status=${status}&sort=${sort}&page=${page}&pageSize=${PAGE_SIZE}`);
  if (res.status === 401) toLogin(locale, "/requests");
  if (res.status === 429) return <TooMany />;
  if (!res.ok) throw new Error("requests failed"); // error.tsx zeigt eine neutrale Seite
  const data = (await res.json()) as PageData;
  const pages = Math.max(1, Math.ceil(data.total / PAGE_SIZE));
  const when = (iso: string) => format.dateTime(new Date(iso), { dateStyle: "medium", timeStyle: "short" });
  const href = (q: { status?: Status; sort?: Sort; page?: number }) => ({
    pathname: "/requests" as const,
    query: { status: q.status ?? status, sort: q.sort ?? sort, page: q.page ?? 1 },
  });

  return (
    <main id="main">
      <div className="page-head">
        <h1><Accent text={t("title")} /></h1>
        <div className="actions"><RefreshButton /><Link href="/requests/new" className="btn primary">{t("newCta")}</Link></div>
      </div>

      <div className="toolbar">
      <nav className="filters" aria-label={t("filterLabel")}>
        {STATUSES.map((s) => (
          <span key={s}>
            {s === status ? <strong aria-current="true">{t(`filter.${s}`)}</strong> : <Link href={href({ status: s })}>{t(`filter.${s}`)}</Link>}{" "}
          </span>
        ))}
      </nav>
      <nav className="filters" aria-label={t("sortLabel")}>
        {SORTS.map((s) => (
          <span key={s}>
            {s === sort ? <strong aria-current="true">{t(`sort.${s}`)}</strong> : <Link href={href({ sort: s })}>{t(`sort.${s}`)}</Link>}{" "}
          </span>
        ))}
      </nav>

      </div>

      <p className="count">{t("total", { total: data.total })}</p>
      {data.items.length === 0 ? (
        <p className="empty">{t("empty")}</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th scope="col">{t("columns.question")}</th>
              <th scope="col">{t("columns.status")}</th>
              <th scope="col">{t("columns.created")}</th>
              <th scope="col">{t("columns.expires")}</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((r) => (
              <tr key={r.id}>
                <td><Link href={`/requests/${r.id}`}>{r.question}</Link></td>
                <td><span className={`st ${r.status}`}>{t(`status.${r.status}`)}</span></td>
                <td>{when(r.createdAt)}</td>
                <td>{when(r.expiresAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {pages > 1 && (
        <nav className="pager" aria-label={t("page", { page, pages })}>
          {page > 1 && <Link href={href({ page: page - 1 })} rel="prev">{t("prev")}</Link>}{" "}
          <span>{t("page", { page, pages })}</span>{" "}
          {page < pages && <Link href={href({ page: page + 1 })} rel="next">{t("next")}</Link>}
        </nav>
      )}
    </main>
  );
}
