"use client";

import { Check, ChevronDown, Globe } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { useDismiss } from "@/components/useDismiss";
import { usePathname } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

const NAMES: Record<string, string> = { de: "Deutsch", en: "English" };

// Normale Links statt <Link locale>: Das Fragment (#...) trägt bei /s/ und /r/ den Schlüssel und muss beim Wechsel erhalten bleiben.
export function LangSwitch() {
  const t = useTranslations("common");
  const current = useLocale();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const ref = useDismiss(open, () => setOpen(false));
  return (
    <div className="lang-dd" ref={ref}>
      <button type="button" className="lang-btn" aria-label={t("language")} aria-expanded={open} aria-controls="lang-panel" onClick={() => setOpen((v) => !v)}>
        <Globe size={16} strokeWidth={1.75} aria-hidden="true" />
        <span className="lang-code">{current}</span>
        <ChevronDown size={12} strokeWidth={2} aria-hidden="true" />
      </button>
      {open && (
        <div className="lang-panel" id="lang-panel">
          {routing.locales.map((l) =>
            l === current ? (
              <span key={l} aria-current="true" lang={l}>{NAMES[l] ?? l}<Check size={14} strokeWidth={2.5} aria-hidden="true" /></span>
            ) : (
              <a
                key={l}
                href={`/${l}${pathname === "/" ? "" : pathname}`}
                lang={l}
                hrefLang={l}
                onClick={(e) => {
                  e.preventDefault();
                  // Volle Navigation, damit das Fragment (#Schlüssel) erhalten bleibt.
                  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
                  window.location.href = `${location.origin}${e.currentTarget.pathname}${location.search}${location.hash}`;
                }}
              >
                {NAMES[l] ?? l}
              </a>
            ),
          )}
        </div>
      )}
    </div>
  );
}
