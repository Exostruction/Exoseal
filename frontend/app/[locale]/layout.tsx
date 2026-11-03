import { Fraunces, Inter } from "next/font/google";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { siteUrl } from "@/lib/site";
import "../globals.css";

// Akzentschrift für einzelne Titelwörter. next/font lädt sie beim Build und liefert sie selbst aus, es gibt keine Anfrage an Google.
// Fließtext und Überschriften: Inter, ebenfalls selbst ausgeliefert (OFL).
const inter = Inter({ subsets: ["latin"], display: "swap", variable: "--font-inter" });
const fraunces = Fraunces({ subsets: ["latin"], style: "italic", display: "swap", variable: "--font-fraunces" });

// Gespeichertes Farbschema setzen, bevor die Seite zeichnet (kein Aufblitzen). Nur lokal gespeichert, nie an den Server gesendet.
const THEME_INIT = 'try{var t=localStorage.getItem("theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}';

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata() {
  const name = (await getTranslations("common"))("appName");
  return { metadataBase: new URL(siteUrl()), title: { default: name, template: `%s | ${name}` }, applicationName: name };
}

export default async function LocaleLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <html lang={locale} className={`${fraunces.variable} ${inter.variable}`} suppressHydrationWarning>
      <head>
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
      </head>
      <body>
        <NextIntlClientProvider>
          <a className="skip" href="#main">{(await getTranslations("common"))("skip")}</a>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
