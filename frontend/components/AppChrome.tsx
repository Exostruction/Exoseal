import { getTranslations } from "next-intl/server";
import { AppTabs } from "@/components/AppTabs";
import { LangSwitch } from "@/components/LangSwitch";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Link } from "@/i18n/navigation";
import { getMe } from "@/lib/backend";
import { MAKER } from "@/lib/site";

// Kopf für den Bereich nach der Anmeldung: Reiter der App, Konto, kein Werbe-Menü.
export async function AppHeader() {
  const [t, a, me] = await Promise.all([getTranslations("common"), getTranslations("auth"), getMe()]);
  return (
    <header className="bar app-bar">
      <div className="bar-in">
        <Link href="/new" className="brand"><Logo height={40} title={t("appName")} /></Link>
        <AppTabs />
        <div className="bar-end">
          <ThemeToggle />
          <LangSwitch />
          {me && (
            <form method="post" action="/api/v1/auth/logout" className="who-bar">
              <span title={me.email ?? me.name ?? me.sub}>{me.email ?? me.name ?? me.sub}</span>
              <button type="submit">{a("logout")}</button>
            </form>
          )}
        </div>
      </div>
    </header>
  );
}

// Schlichter Kopf für Empfänger-Seiten, Anmeldung und Fehlerseiten: nur Name, Farbschema, Sprache.
export async function PlainHeader() {
  const t = await getTranslations("common");
  return (
    <header className="bar">
      <div className="bar-in">
        <Link href="/" className="brand"><Logo height={40} title={t("appName")} /></Link>
        <span />
        <div className="bar-end">
          <ThemeToggle />
          <LangSwitch />
        </div>
      </div>
    </header>
  );
}

export async function MiniFooter() {
  const [t, l] = await Promise.all([getTranslations("common.foot"), getTranslations("legal")]);
  return (
    <footer className="foot-mini">
      <span>{t.rich("bottom", { maker: (c) => <a href={MAKER.url} rel="noopener">{c}</a> })}</span>
      <nav>
        <Link href="/privacy">{l("privacyLink")}</Link>
        <Link href="/imprint">{l("imprintLink")}</Link>
      </nav>
    </footer>
  );
}
