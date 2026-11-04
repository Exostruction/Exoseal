"use client";

import { Check, Copy } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Msg } from "@/components/Msg";
import { CryptoError } from "@/lib/crypto";
import { decryptWithPrivateKey, unwrapPrivateKey } from "@/lib/pkcrypto";

type ErrorKey = "wrongPassphrase" | "gone" | "corrupt" | "rateLimited" | "generic";

export function OpenResponse({ id }: { id: string }) {
  const t = useTranslations("requests.open");
  const [pass, setPass] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ErrorKey | null>(null);
  const [answer, setAnswer] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const fail = (status: number): ErrorKey => (status === 404 ? "gone" : status === 429 ? "rateLimited" : "generic");

  async function open(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      // 1) verschlüsselten Private Key holen (verbraucht nichts) und mit der Passphrase freischalten.
      //    Ein Tippfehler kostet die Antwort also nichts.
      const keyRes = await fetch(`/api/v1/requests/${id}/key`);
      if (!keyRes.ok) return setError(fail(keyRes.status));
      const { wrappedPrivateKey } = (await keyRes.json()) as { wrappedPrivateKey: string };
      let privateKey: CryptoKey;
      try {
        privateKey = await unwrapPrivateKey(wrappedPrivateKey, pass);
      } catch (err) {
        return setError(err instanceof CryptoError && err.reason === "wrong-key-or-password" ? "wrongPassphrase" : "corrupt");
      }

      // 2) erst jetzt die Antwort abholen: ab hier ist sie auf dem Server gelöscht.
      const res = await fetch(`/api/v1/requests/${id}/open`, { method: "POST" });
      if (!res.ok) return setError(fail(res.status));
      const { ciphertext } = (await res.json()) as { ciphertext: string };
      try {
        setAnswer(await decryptWithPrivateKey(ciphertext, privateKey));
        setPass("");
        // Kein router.refresh(): Die Antwort ist jetzt auf dem Server gelöscht. Ein Neuladen würde diese Komponente
        // ausblenden (Status "geöffnet") und den einzigen Klartext mit ihr verwerfen.
      } catch {
        setError("corrupt");
      }
    } catch {
      setError("generic");
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(answer ?? "");
      setCopied(true);
    } catch {
      /* Clipboard nicht erlaubt: Nutzer kann den Text markieren */
    }
  }

  if (answer !== null) {
    return (
      <section className="reveal">
        <div className="field">
          <label htmlFor="answer">{t("answerLabel")}</label>
          <textarea id="answer" readOnly value={answer} rows={8} onFocus={(e) => e.currentTarget.select()} />
        </div>
        <button type="button" className="primary copy-btn" onClick={copy}>{copied ? <Check size={18} aria-hidden="true" /> : <Copy size={18} aria-hidden="true" />}{copied ? t("copied") : t("copy")}</button>
        <Msg kind="ok">{t("deleted")}</Msg>
      </section>
    );
  }

  return (
    <form onSubmit={open} className="reveal">
      <h2>{t("title")}</h2>
      <p className="lead-s">{t("text")}</p>
      <div className="field">
        <label htmlFor="pass">{t("passphrase")}</label>
        <input id="pass" type="password" autoComplete="current-password" value={pass} onChange={(e) => setPass(e.target.value)} required />
      </div>
      <button type="submit" className="primary" disabled={busy}>{busy ? t("working") : t("submit")}</button>
      {error && <Msg kind="err">{t(`errors.${error}`)}</Msg>}
    </form>
  );
}
