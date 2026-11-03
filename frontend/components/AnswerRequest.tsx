"use client";

import { CheckCircle2 } from "lucide-react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { useEffect, useState, useSyncExternalStore } from "react";
import { Msg } from "@/components/Msg";
import { MAX_PLAINTEXT_BYTES } from "@/lib/crypto";
import { encryptToPublicKey, fingerprintOf } from "@/lib/pkcrypto";

type ErrorKey = "gone" | "missingKey" | "mismatch" | "empty" | "tooLarge" | "rateLimited" | "generic";
type Info = { question: string; ownerName: string | null; publicKey: string; expiresAt: string };

// Der Fingerabdruck steht im Fragment (#...) und geht nie an den Server. null = noch im Server-Render, "" = fehlt.
const subscribe = (cb: () => void) => {
  window.addEventListener("hashchange", cb);
  return () => window.removeEventListener("hashchange", cb);
};
const readHash = () => location.hash.slice(1);

export function AnswerRequest({ id }: { id: string }) {
  const t = useTranslations("answer");
  const format = useFormatter();
  const locale = useLocale();
  const fingerprint = useSyncExternalStore(subscribe, readHash, () => null);

  const [loaded, setLoaded] = useState<{ info: Info } | { error: ErrorKey } | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<ErrorKey | null>(null);

  useEffect(() => {
    if (!fingerprint) return; // null (Server-Render) oder fehlt: nichts laden, Fehler wird unten abgeleitet
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/v1/requests/${id}/public`, { headers: { "accept-language": locale } });
        if (!res.ok) return !cancelled && setLoaded({ error: res.status === 404 ? "gone" : res.status === 429 ? "rateLimited" : "generic" });
        const info = (await res.json()) as Info;
        // Passt der Schlüssel vom Server zum Fingerabdruck im Link? Sonst wurde er ausgetauscht: nichts eingeben lassen.
        if ((await fingerprintOf(info.publicKey)) !== fingerprint) return !cancelled && setLoaded({ error: "mismatch" });
        if (!cancelled) setLoaded({ info });
      } catch {
        if (!cancelled) setLoaded({ error: "generic" });
      }
    })();
    return () => { cancelled = true; };
  }, [id, fingerprint, locale]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!loaded || !("info" in loaded)) return;
    setError(null);
    if (!text.trim()) return setError("empty");
    if (new TextEncoder().encode(text).length > MAX_PLAINTEXT_BYTES) return setError("tooLarge");
    setBusy(true);
    try {
      const ciphertext = await encryptToPublicKey(text, loaded.info.publicKey); // Verschlüsselung im Browser des Kunden
      const res = await fetch(`/api/v1/requests/${id}/answer`, {
        method: "POST",
        headers: { "content-type": "application/json", "accept-language": locale },
        body: JSON.stringify({ ciphertext }),
      });
      if (res.ok) {
        setText("");
        history.replaceState(null, "", location.pathname);
        return setDone(true);
      }
      setError(res.status === 404 ? "gone" : res.status === 413 ? "tooLarge" : res.status === 429 ? "rateLimited" : "generic");
    } catch {
      setError("generic");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="reveal done" role="status">
        <CheckCircle2 size={44} strokeWidth={1.5} aria-hidden="true" />
        <h1>{t("doneTitle")}</h1>
        <p className="lead-s">{t("doneText")}</p>
        <p className="lead-s">{t("doneHint")}</p>
      </div>
    );
  }

  const failure: ErrorKey | null = fingerprint === "" ? "missingKey" : loaded && "error" in loaded ? loaded.error : null;
  if (failure) return <Msg kind="err">{t(`errors.${failure}`)}</Msg>;
  if (!loaded || "error" in loaded) return <p className="lead-s">{t("loading")}</p>; // Fehler sind oben schon behandelt

  const { info } = loaded;
  return (
    <form onSubmit={submit} className="reveal">
      <h1>{info.ownerName ? t("titleNamed", { owner: info.ownerName }) : t("titleAnon")}</h1>
      <blockquote>{info.question}</blockquote>
      <p className="lead-s">{t("validUntil", { date: format.dateTime(new Date(info.expiresAt), { dateStyle: "medium", timeStyle: "short" }) })}</p>
      <div className="field">
        <label htmlFor="answer">{t("textLabel")}</label>
        <textarea id="answer" value={text} onChange={(e) => setText(e.target.value)} rows={8} aria-describedby="answer-hint" required />
        <small id="answer-hint">{t("textHint", { max: MAX_PLAINTEXT_BYTES })}</small>
      </div>
      {error && <Msg kind="err">{t(`errors.${error}`)}</Msg>}
      <button type="submit" className="primary" disabled={busy}>{busy ? t("sending") : t("submit")}</button>
    </form>
  );
}
