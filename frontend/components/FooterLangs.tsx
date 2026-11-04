"use client";

import { useLocale, useTranslations } from "next-intl";
import { usePathname } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

const NAMES: Record<string, string> = { de: "Deutsch", en: "English" };

// Sichtbare, crawlbare Sprachlinks im Fuß (der Umschalter im Kopf zeigt seine Links nur geöffnet). Normale <a>, kein Router: volle Navigation.
export function FooterLangs() {
  const t = useTranslations("common");
  const current = useLocale();
  const pathname = usePathname();
  return (
    <nav className="foot-langs" aria-label={t("language")}>
      {routing.locales.map((l) =>
        l === current ? (
          <span key={l} lang={l} aria-current="true">{NAMES[l] ?? l}</span>
        ) : (
          <a key={l} href={`/${l}${pathname === "/" ? "" : pathname}`} lang={l} hrefLang={l}>{NAMES[l] ?? l}</a>
        ),
      )}
    </nav>
  );
}
