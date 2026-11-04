"use client";

import { RefreshCw } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { useRouter } from "@/i18n/navigation";

// Lädt die Liste neu (Server-Daten), ohne die Seite zu verlassen. Der Zustand von Filter und Seite bleibt, weil er in der Adresse steht.
export function RefreshButton() {
  const t = useTranslations("common");
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button type="button" className="refresh-btn" onClick={() => start(() => router.refresh())} disabled={pending} aria-live="polite">
      <RefreshCw size={16} aria-hidden="true" className={pending ? "spin" : undefined} />
      {pending ? t("refreshing") : t("refresh")}
    </button>
  );
}
