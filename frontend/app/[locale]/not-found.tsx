import { ArrowRight } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { ErrorView } from "@/components/ErrorView";
import { SiteFooter, SiteHeader } from "@/components/SiteHeader";
import { Link } from "@/i18n/navigation";

// Antwortstatus ist 404. Nicht indexieren, aber echte Wege zurück anbieten.
export const metadata = { robots: { index: false, follow: true } };

const LINKS = [["/faq", "faq"], ["/#how", "how"], ["/guides", "guides"], ["/sitemap", "sitemap"]] as const;

export default async function NotFound() {
  const [t, f] = await Promise.all([getTranslations("errors"), getTranslations("common.foot")]);
  return (
    <>
      <SiteHeader />
      <ErrorView code="404" title={t("notFoundTitle")} text={t("notFoundText")}>
        <div className="actions">
          <Link href="/" className="btn primary">{t("home")}<ArrowRight size={16} aria-hidden="true" /></Link>
        </div>
        <nav className="quick" aria-label={t("quickLabel")}>
          <span>{t("help")}</span>
          {LINKS.map(([href, k]) => (
            <Link key={k} href={href}>{f(k)}</Link>
          ))}
        </nav>
      </ErrorView>
      <SiteFooter />
    </>
  );
}
