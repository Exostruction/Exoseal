import { ImageResponse } from "next/og";
import { getTranslations } from "next-intl/server";
import { LOGO_DARK_DATA_URL } from "@/lib/brand";

export const alt = "ExoSeal";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Vorschaubild für Soziale Netzwerke und Messenger, pro Sprache.
export default async function Image({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const l = await getTranslations({ locale: locale === "de" ? "de" : "en", namespace: "landing" });
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "flex-end", padding: 80, background: "#0b0b0e", color: "#fff", backgroundImage: "radial-gradient(circle at 100% 0%, rgba(225,29,72,0.55), rgba(11,11,14,0) 60%)" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={LOGO_DARK_DATA_URL} width={300} height={83} alt="ExoSeal" style={{ marginBottom: 36 }} />
        <div style={{ display: "flex", fontSize: 84, fontWeight: 700, lineHeight: 1.05, letterSpacing: -2 }}>{l.raw("title").replace(/<\/?once>/g, "")}</div>
        <div style={{ display: "flex", fontSize: 30, color: "#d4d4d8", marginTop: 28 }}>{(await getTranslations({ locale: locale === "de" ? "de" : "en", namespace: "common.foot" })).raw("tagline").replace(/<\/?once>/g, "")}</div>
      </div>
    ),
    size,
  );
}
