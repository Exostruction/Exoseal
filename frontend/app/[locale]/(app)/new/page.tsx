import { Accent } from "@/components/Accent";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { CreateSecret } from "@/components/CreateSecret";
import { routing } from "@/i18n/routing";
import { toLogin } from "@/lib/auth";
import { getMe } from "@/lib/backend";

export const metadata = { robots: { index: false }, referrer: "no-referrer" as const };

export default async function NewSecretPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const [t, me] = await Promise.all([getTranslations("create"), getMe()]);
  if (!me) toLogin(locale, "/new");
  return (
    <main id="main">
      <div className="page-head">
        <h1><Accent text={t("title")} /></h1>
        <p>{t("intro")}</p>
      </div>
      <CreateSecret />
    </main>
  );
}
