import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

// Header für alle Antworten. Die CSP kommt pro Request (mit Nonce) aus proxy.ts.
const securityHeaders = [
  // Secret-IDs stehen im Pfad: kein Referer an andere Seiten.
  { key: "Referrer-Policy", value: "no-referrer" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
  // Wirkt nur über https (sonst vom Browser ignoriert).
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
];

const config: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  // Titelbilder des Herausgeber-Blogs (nur dieser Pfad) werden vom eigenen Server geholt und ausgeliefert.
  images: { remotePatterns: [{ protocol: "https", hostname: "exostruction.com", pathname: "/blog/**" }] },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // Seiten rund um Secrets nie zwischenspeichern lassen.
      { source: "/:locale(en|de)/:path(new|s/.*)", headers: [{ key: "Cache-Control", value: "no-store" }] },
    ];
  },
  // Übliche Schreibweisen der Sitemap führen alle zur echten Datei.
  async redirects() {
    return ["/sitemap_index.xml", "/sitemap.txt", "/sitemaps.xml", "/sitemap.xml.gz"].map((source) => ({ source, destination: "/sitemap.xml", permanent: true }));
  },
  // Backend ist nur im internen Docker-Netz erreichbar; das Frontend proxyt /api/* dorthin.
  async rewrites() {
    return [{ source: "/api/v1/:path*", destination: `${process.env.BACKEND_URL ?? "http://backend:8080"}/:path*` }];
  },
};
export default createNextIntlPlugin("./i18n/request.ts")(config);
