"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Msg } from "@/components/Msg";

type GoneKey = "gone" | "goneOpened" | "goneExpired" | "goneReported" | "goneRevoked";

export function ReportSecret({ id }: { id: string }) {
  const t = useTranslations("report");
  const locale = useLocale();
  const [phase, setPhase] = useState<"idle" | "busy" | "done">("idle");
  const [error, setError] = useState<"rateLimited" | "generic" | GoneKey | null>(null);

  async function report() {
    if (phase !== "idle") return;
    setError(null);
    setPhase("busy");
    try {
      const res = await fetch(`/api/v1/secrets/${id}/report`, { method: "POST", headers: { "accept-language": locale } });
      if (res.ok) return setPhase("done");
      if (res.status === 404) {
        // Der Link war schon weg: der Server sagt warum. Gelöscht wurde dabei nichts, also keine Erfolgsmeldung.
        const reason = ((await res.json().catch(() => ({}))) as { reason?: string }).reason;
        return setError(reason === "opened" ? "goneOpened" : reason === "expired" ? "goneExpired" : reason === "reported" ? "goneReported" : reason === "revoked" ? "goneRevoked" : "gone");
      }
      setError(res.status === 429 ? "rateLimited" : "generic");
    } catch {
      setError("generic");
    }
    setPhase("idle");
  }

  const final = error !== null && error !== "rateLimited" && error !== "generic";
  if (phase === "done") return <Msg kind="ok">{t("done")}</Msg>;
  return (
    <>
      {error && <Msg kind={final ? "info" : "err"}>{t(`errors.${error}`)}</Msg>}
      {!final && <button type="button" className="danger" onClick={report} disabled={phase === "busy"}>{phase === "busy" ? t("submitting") : t("submit")}</button>}
    </>
  );
}
