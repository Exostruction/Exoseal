"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Msg } from "@/components/Msg";
import { useRouter } from "@/i18n/navigation";

export function DeleteRequest({ id }: { id: string }) {
  const t = useTranslations("requests.delete");
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState(false);

  async function remove() {
    setError(false);
    try {
      const res = await fetch(`/api/v1/requests/${id}`, { method: "DELETE" });
      if (!res.ok && res.status !== 404) return setError(true);
      router.push("/requests");
      router.refresh();
    } catch {
      setError(true);
    }
  }

  if (!confirming) return <button type="button" className="danger" onClick={() => setConfirming(true)}>{t("button")}</button>;
  return (
    <div role="group" aria-label={t("button")}>
      <Msg kind="info">{t("confirm")}</Msg>
      <div className="actions confirm-actions">
        <button type="button" className="danger" onClick={remove}>{t("confirmButton")}</button>
        <button type="button" onClick={() => setConfirming(false)}>{t("cancel")}</button>
      </div>
      {error && <Msg kind="err">{t("error")}</Msg>}
    </div>
  );
}
