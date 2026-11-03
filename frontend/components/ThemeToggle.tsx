"use client";

import { Moon, Sun } from "lucide-react";
import { useTranslations } from "next-intl";
import { useSyncExternalStore } from "react";

// Hell/Dunkel: ohne Auswahl gilt die Systemeinstellung. Die Auswahl liegt nur lokal im Browser (localStorage), nie auf dem Server.
type Theme = "light" | "dark";
const MEDIA = "(prefers-color-scheme: dark)";

const subscribe = (cb: () => void) => {
  const m = window.matchMedia(MEDIA);
  m.addEventListener("change", cb);
  window.addEventListener("themechange", cb);
  return () => { m.removeEventListener("change", cb); window.removeEventListener("themechange", cb); };
};
const current = (): Theme => {
  const t = document.documentElement.dataset.theme;
  return t === "dark" || t === "light" ? t : window.matchMedia(MEDIA).matches ? "dark" : "light";
};

export function ThemeToggle() {
  const t = useTranslations("common.theme");
  const theme = useSyncExternalStore<Theme | null>(subscribe, current, () => null);
  if (!theme) return <span className="icon-btn" aria-hidden="true" />;
  const dark = theme === "dark";
  return (
    <button
      type="button"
      className="icon-btn"
      aria-label={dark ? t("toLight") : t("toDark")}
      onClick={() => {
        const next: Theme = dark ? "light" : "dark";
        document.documentElement.dataset.theme = next;
        try { localStorage.setItem("theme", next); } catch { /* Speicher gesperrt: gilt nur für diese Sitzung */ }
        window.dispatchEvent(new Event("themechange"));
      }}
    >
      {dark ? <Sun size={18} strokeWidth={1.75} /> : <Moon size={18} strokeWidth={1.75} />}
    </button>
  );
}
