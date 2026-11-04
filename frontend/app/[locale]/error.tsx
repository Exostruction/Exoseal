"use client";

import { ArrowRight, RotateCw } from "lucide-react";
import { useTranslations } from "next-intl";
import { ErrorView } from "@/components/ErrorView";
import { Logo } from "@/components/Logo";
import { Link } from "@/i18n/navigation";

// Zeigt bewusst nie error.message: Fehlertexte könnten Pfade oder Inhalte enthalten.
export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  const t = useTranslations("errors");
  const c = useTranslations("common");
  return (
    <>
      <header className="bar">
        <div className="bar-in">
          <Link href="/" className="brand"><Logo height={40} title={c("appName")} /></Link>
        </div>
      </header>
      <ErrorView code="500" title={t("errorTitle")} text={t("errorText")}>
        <div className="actions">
          <button type="button" className="primary" onClick={reset}><RotateCw size={16} aria-hidden="true" />{t("retry")}</button>
          <Link href="/" className="btn">{t("home")}<ArrowRight size={16} aria-hidden="true" /></Link>
        </div>
      </ErrorView>
    </>
  );
}
