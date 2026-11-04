"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";

// Zwei Gruppen: was mit dem Senden eines Geheimnisses zu tun hat, und was mit Anfragen beim Kunden. Die Gruppe mit der aktuellen Seite ist hervorgehoben.
export function AppTabs() {
  const t = useTranslations("common");
  const p = usePathname();
  const groups = [
    { id: "send", label: t("groupSend"), tabs: [
      { href: "/new", label: t("tabNew"), on: p === "/new" },
      { href: "/sent", label: t("sentCta"), on: p === "/sent" },
    ] },
    { id: "requests", label: t("groupRequests"), tabs: [
      { href: "/requests/new", label: t("newRequestCta"), on: p === "/requests/new" },
      { href: "/requests", label: t("tabRequests"), on: p === "/requests" || /^\/requests\/(?!new)/.test(p) },
    ] },
  ] as const;
  return (
    <nav className="app-tabs" aria-label={t("appNav")}>
      {groups.map((g, i) => (
        <div key={g.id} className="tab-group" role="group" aria-labelledby={`tabs-${g.id}`}>
          {i > 0 && <span className="tab-sep" aria-hidden="true" />}
          <span className="tab-label" id={`tabs-${g.id}`}>{g.label}</span>
          <div className="tab-links">
            {g.tabs.map((x) => <Link key={x.href} href={x.href} aria-current={x.on ? "page" : undefined}>{x.label}</Link>)}
          </div>
        </div>
      ))}
    </nav>
  );
}
