import createMiddleware from "next-intl/middleware";
import { NextRequest } from "next/server";
import { routing } from "./i18n/routing";
import { buildCsp } from "./lib/security";

const intl = createMiddleware(routing);

export default function proxy(request: NextRequest) {
  // Nonce pro Request. Next liest ihn aus dem CSP-Header des Requests und versieht seine eigenen Skripte damit.
  const nonce = btoa(crypto.randomUUID());
  const csp = buildCsp(nonce, {
    dev: process.env.NODE_ENV !== "production",
    https: process.env.PUBLIC_URL?.startsWith("https://"),
  });
  const headers = new Headers(request.headers);
  headers.set("x-nonce", nonce);
  headers.set("content-security-policy", csp);

  const response = intl(new NextRequest(request, { headers }));
  response.headers.set("content-security-policy", csp);
  return response;
}

// API, Next-Interna und die wenigen echten Dateien bleiben unangetastet. Alles andere (auch Adressen mit Punkt wie /sitemap.xx)
// bekommt ein Sprachpräfix und landet bei Unbekanntem auf der eigenen 404-Seite statt auf der Next-Standardseite.
export const config = { matcher: "/((?!api|_next|robots\.txt|sitemap\.xml|llms\.txt|manifest\.webmanifest|icon\.svg|favicon\.ico|apple-icon\.png|feed\.xml|changelog\.json).*)" };
