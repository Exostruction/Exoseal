import { Accent } from "@/components/Accent";
import { hasLocale } from "next-intl";
import { notFound, redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { LogoMark } from "@/components/Logo";
import { routing } from "@/i18n/routing";
import { safeReturn } from "@/lib/auth";
import { getMe } from "@/lib/backend";

export const metadata = { robots: { index: false } };

export default async function LoginPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ returnUrl?: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const [{ returnUrl }, t, me] = await Promise.all([searchParams, getTranslations("auth"), getMe()]);
  const back = safeReturn(returnUrl, `/${locale}/new`);
  if (me) redirect(back);
  return (
    <main id="main" className="login-page">
      <div className="login">
        <span className="mark"><LogoMark size={52} /></span>
        <h1><Accent text={t("loginTitle")} /></h1>
        <p>{t("loginText")}</p>
        {/* Anmeldung ist ein Redirect-Flow über das Backend, kein Client-Routing. */}
        <a className="btn primary big" href={`/api/v1/auth/login?returnUrl=${encodeURIComponent(back)}`}>{t("login")}</a>
      </div>
    </main>
  );
}
