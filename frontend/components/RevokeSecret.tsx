"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Msg } from "@/components/Msg";
import { useRouter } from "@/i18n/navigation";

// Zieht einen noch nicht abgerufenen Link zurück. Danach sagt der Link selbst, dass er zurückgezogen wurde.
// Bestätigung und Fehler stehen direkt an der Stelle (wie beim Löschen einer Anfrage), kein Browser-Dialog.
export function RevokeSecret({ id }: { id: string }) {
  const t = useTranslations("sent");
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  async function revoke() {
    setError(false);
    setBusy(true);
    try {
      const res = await fetch(`/api/v1/secrets/${id}`, { method: "DELETE" });
      if (!res.ok && res.status !== 404) return setError(true);
      router.refresh();
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  if (!confirming) return <button type="button" className="link-btn" onClick={() => setConfirming(true)}>{t("revoke")}</button>;
  return (
    <div role="group" aria-label={t("revoke")} className="confirm-inline">
      <span>{t("confirm")}</span>
      <button type="button" className="link-btn danger" onClick={revoke} disabled={busy}>{busy ? t("revoking") : t("confirmYes")}</button>
      <button type="button" className="link-btn" onClick={() => setConfirming(false)} disabled={busy}>{t("cancel")}</button>
      {error && <Msg kind="err">{t("error")}</Msg>}
    </div>
  );
}
