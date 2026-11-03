"use client";

import { Check, Copy } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Msg } from "@/components/Msg";
import { Link } from "@/i18n/navigation";
import { MIN_PASSPHRASE_LENGTH, createRequestKeys } from "@/lib/pkcrypto";

const DAYS = ["1", "3", "7", "14", "30"] as const;
type ErrorKey = "question" | "tooShort" | "mismatch" | "unauthorized" | "rateLimited" | "quota" | "generic";

export function CreateRequest() {
  const t = useTranslations("newRequest");
  const locale = useLocale();
  const [question, setQuestion] = useState("");
  const [days, setDays] = useState<(typeof DAYS)[number]>("7");
  const [pass, setPass] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ErrorKey | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const q = question.trim();
    if (q.length === 0 || q.length > 200) return setError("question");
    if (pass.length < MIN_PASSPHRASE_LENGTH) return setError("tooShort");
    if (pass !== confirm) return setError("mismatch");

    setBusy(true);
    try {
      // Schlüsselpaar entsteht hier im Browser. Zum Server gehen nur der Public Key und der mit der Passphrase verschlüsselte Private Key.
      const keys = await createRequestKeys(pass);
      const res = await fetch("/api/v1/requests", {
        method: "POST",
        headers: { "content-type": "application/json", "accept-language": locale },
        body: JSON.stringify({ question: q, publicKey: keys.publicKey, wrappedPrivateKey: keys.wrappedPrivateKey, expiresInDays: Number(days) }),
      });
      if (!res.ok) return setError(res.status === 401 ? "unauthorized" : res.status === 429 ? "rateLimited" : res.status === 409 ? "quota" : "generic");
      const { id } = (await res.json()) as { id: string };
      setLink(`${location.origin}/${locale}/r/${id}#${keys.fingerprint}`);
      setPass("");
      setConfirm("");
    } catch {
      setError("generic");
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(link ?? "");
      setCopied(true);
    } catch {
      /* Clipboard nicht erlaubt: Nutzer kann das Feld markieren */
    }
  }

  if (link) {
    return (
      <section aria-labelledby="link-title" className="result">
        <h2 id="link-title">{t("linkTitle")}</h2>
        <p className="result-hint">{t("linkHint")}</p>
        <div className="copy-row">
          <input readOnly value={link} aria-label={t("linkTitle")} onFocus={(e) => e.currentTarget.select()} />
          <button type="button" className="primary" onClick={copy}>{copied ? <Check size={18} aria-hidden="true" /> : <Copy size={18} aria-hidden="true" />}{copied ? t("copied") : t("copy")}</button>
        </div>
        <div className="actions">
          <Link href="/requests" className="btn">{t("toList")}</Link>
        </div>
      </section>
    );
  }

  return (
    <form onSubmit={submit} className="rows">
      <div className="field">
        <label htmlFor="question">{t("questionLabel")}</label>
        <small id="question-hint">{t("questionHint")}</small>
        <input id="question" value={question} maxLength={200} onChange={(e) => setQuestion(e.target.value)} aria-describedby="question-hint" required />
      </div>
      <div className="field">
        <label htmlFor="days">{t("expiryLabel")}</label>
        <select id="days" value={days} onChange={(e) => setDays(e.target.value as (typeof DAYS)[number])}>
          {DAYS.map((d) => <option key={d} value={d}>{t(`expiry.${d}`)}</option>)}
        </select>
      </div>
      <div className="field">
        <label htmlFor="pass">{t("passphraseLabel")}</label>
        <small id="pass-hint">{t("passphraseHint", { min: MIN_PASSPHRASE_LENGTH })}</small>
        <input id="pass" type="password" autoComplete="new-password" value={pass} onChange={(e) => setPass(e.target.value)} aria-describedby="pass-hint" required />
      </div>
      <div className="field">
        <label htmlFor="confirm">{t("confirmLabel")}</label>
        <input id="confirm" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
      </div>
      {error && <Msg kind="err">{t(`errors.${error}`)}</Msg>}
      <div className="submit"><button type="submit" className="primary" disabled={busy}>{busy ? t("submitting") : t("submit")}</button></div>
    </form>
  );
}
