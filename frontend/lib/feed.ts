import deGuides from "../messages/de/guides.json";
import enGuides from "../messages/en/guides.json";
import dePages from "../messages/de/pages.json";
import enPages from "../messages/en/pages.json";
import { siteUrl } from "@/lib/site";

export type FeedItem = { id: string; title: string; summary: string; date: string; url: string };
export type Lang = "de" | "en";

export function feedLang(v: string | null): Lang {
  return v === "de" ? "de" : "en";
}

// Änderungen und Anleitungen, neueste zuerst. Quelle sind die Übersetzungsdateien, es gibt keine zweite Pflegestelle.
export function feedItems(lang: Lang): FeedItem[] {
  const base = siteUrl();
  const pages = lang === "de" ? dePages : enPages;
  const guides = lang === "de" ? deGuides : enGuides;
  const log = Object.entries(pages.changelog.items).map(([k, v]) => ({ id: `${base}/${lang}/changelog#${k}`, title: `v${v.version}: ${v.title}`, summary: v.text, date: v.date, url: `${base}/${lang}/changelog` }));
  const gs = Object.entries(guides.items).map(([slug, g]) => ({ id: `${base}/${lang}/guides/${slug}`, title: g.title, summary: g.description, date: g.updated, url: `${base}/${lang}/guides/${slug}` }));
  return [...log, ...gs].sort((a, b) => b.date.localeCompare(a.date));
}

export const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
