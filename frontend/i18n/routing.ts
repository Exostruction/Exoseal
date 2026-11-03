import { defineRouting } from "next-intl/routing";

// Sprache steckt in der URL (/de, /en). Bewusst kein Locale-Cookie: Besucher bekommen keine Cookies.
// Erstbesuch auf "/" wird per Accept-Language weitergeleitet. Gegenstück im Backend: Locales.cs
export const routing = defineRouting({
  locales: ["en", "de"],
  defaultLocale: "en",
  localePrefix: "always",
  localeCookie: false,
});
