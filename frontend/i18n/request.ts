import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import namespaces from "../messages/namespaces.json";
import { routing } from "./routing";

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;
  // messages/<locale>/<namespace>.json -> { <namespace>: {...} }
  const entries = await Promise.all(
    namespaces.map(async (ns) => [ns, (await import(`../messages/${locale}/${ns}.json`)).default] as const),
  );
  return { locale, messages: Object.fromEntries(entries) };
});
