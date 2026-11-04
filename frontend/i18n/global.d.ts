import type answer from "../messages/de/answer.json";
import type auth from "../messages/de/auth.json";
import type common from "../messages/de/common.json";
import type create from "../messages/de/create.json";
import type errors from "../messages/de/errors.json";
import type landing from "../messages/de/landing.json";
import type legal from "../messages/de/legal.json";
import type newRequest from "../messages/de/newRequest.json";
import type report from "../messages/de/report.json";
import type requests from "../messages/de/requests.json";
import type reveal from "../messages/de/reveal.json";
import type guides from "../messages/de/guides.json";
import type pages from "../messages/de/pages.json";
import type sent from "../messages/de/sent.json";
import type sitemap from "../messages/de/sitemap.json";

// Typsicherheit: Schlüssel werden gegen die deutschen Dateien geprüft (en wird per check-i18n angeglichen).
declare module "next-intl" {
  interface AppConfig {
    Locale: (typeof import("./routing").routing.locales)[number];
    Messages: {
      common: typeof common; auth: typeof auth; create: typeof create; reveal: typeof reveal; report: typeof report;
      errors: typeof errors; newRequest: typeof newRequest; requests: typeof requests; answer: typeof answer; landing: typeof landing; legal: typeof legal; sitemap: typeof sitemap; guides: typeof guides; pages: typeof pages; sent: typeof sent;
    };
  }
}
