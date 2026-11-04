"use client";

import { Check, Copy } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Msg } from "@/components/Msg";
import { MAX_PLAINTEXT_BYTES, encrypt } from "@/lib/crypto";

const TTL_MINUTES = { "1h": 60, "1d": 24 * 60, "7d": 7 * 24 * 60 } as const;
type Ttl = keyof typeof TTL_MINUTES;
type ErrorKey = "empty" | "tooLarge" | "unauthorized" | "rateLimited" | "quota" | "generic";

const bytesOf = (s: string) => new TextEncoder().encode(s).length;

export function CreateSecret() {
  const t = useTranslations("create");
  const locale = useLocale();
  const [text, setText] = useState("");
  const [password, setPassword] = useState("");
  const [label, setLabel] = useState("");
  const [ttl, setTtl] = useState<Ttl>("1d");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ErrorKey | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!text.trim()) return setError("empty");
    if (bytesOf(text) > MAX_PLAINTEXT_BYTES) return setError("tooLarge");
    setBusy(true);
    try {
      // Verschlüsselt wird hier im Browser; zum Server geht nur der Blob, der Schlüssel bleibt im Fragment.
      const { blob, key } = await encrypt(text, password || undefined);
      const res = await fetch("/api/v1/secrets", {
        method: "POST",
        headers: { "content-type": "application/json", "accept-language": locale },
        body: JSON.stringify({ ciphertext: blob, expiresInMinutes: TTL_MINUTES[ttl], label: label.trim() || undefined }),
      });
      if (!res.ok) return setError(res.status === 401 ? "unauthorized" : res.status === 429 ? "rateLimited" : res.status === 413 ? "tooLarge" : res.status === 409 ? "quota" : "generic");
      const { id } = (await res.json()) as { id: string };
      setLink(`${location.origin}/${locale}/s/${id}#${key}`);
      setText("");
      setPassword("");
      setLabel("");
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
          <button type="button" onClick={() => { setLink(null); setCopied(false); }}>{t("another")}</button>
        </div>
      </section>
    );
  }

  return (
    <form onSubmit={submit} className="rows">
      <div className="field">
        <label htmlFor="secret">{t("textLabel")}</label>
        <small id="secret-hint">{t("textHint", { max: MAX_PLAINTEXT_BYTES })}</small>
        <textarea id="secret" value={text} onChange={(e) => setText(e.target.value)} rows={8} aria-describedby="secret-hint" required />
      </div>
      <div className="field">
        <label htmlFor="label">{t("labelLabel")}</label>
        <small id="label-hint">{t("labelHint")}</small>
        <input id="label" type="text" maxLength={80} value={label} onChange={(e) => setLabel(e.target.value)} aria-describedby="label-hint" />
      </div>
      <div className="field">
        <label htmlFor="ttl">{t("expiryLabel")}</label>
        <select id="ttl" value={ttl} onChange={(e) => setTtl(e.target.value as Ttl)}>
          {(Object.keys(TTL_MINUTES) as Ttl[]).map((k) => <option key={k} value={k}>{t(`expiry.${k}`)}</option>)}
        </select>
      </div>
      <div className="field">
        <label htmlFor="pw">{t("passwordLabel")}</label>
        <small id="pw-hint">{t("passwordHint")}</small>
        <input id="pw" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} aria-describedby="pw-hint" />
      </div>
      {error && <Msg kind="err">{t(`errors.${error}`)}</Msg>}
      <div className="submit"><button type="submit" className="primary" disabled={busy}>{busy ? t("submitting") : t("submit")}</button></div>
    </form>
  );
}
