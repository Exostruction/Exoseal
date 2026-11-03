"use client";

import { Check, Copy } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState, useSyncExternalStore } from "react";
import { Msg } from "@/components/Msg";
import { Link } from "@/i18n/navigation";
import { CryptoError, decrypt, needsPassword } from "@/lib/crypto";

type ErrorKey = "gone" | "goneOpened" | "goneExpired" | "goneReported" | "goneRevoked" | "missingKey" | "wrongPassword" | "corrupt" | "rateLimited" | "generic";

// Der Schlüssel steht im URL-Fragment (#...) und wird vom Browser nie an den Server geschickt.
// null = noch nicht im Browser (Server-Render), "" = Fragment fehlt.
const subscribe = (cb: () => void) => {
  window.addEventListener("hashchange", cb);
  return () => window.removeEventListener("hashchange", cb);
};
const readKey = () => location.hash.slice(1);

export function RevealSecret({ id }: { id: string }) {
  const t = useTranslations("reveal");
  const locale = useLocale();
  const key = useSyncExternalStore(subscribe, readKey, () => null);
  const [phase, setPhase] = useState<"idle" | "loading" | "password" | "done">("idle");
  const [blob, setBlob] = useState<string | null>(null); // nur im Speicher: so kostet ein Tippfehler beim Passwort das Secret nicht
  const [password, setPassword] = useState("");
  const [secret, setSecret] = useState("");
  const [error, setError] = useState<ErrorKey | null>(null);
  const [copied, setCopied] = useState(false);

  const finish = (plain: string) => {
    setSecret(plain);
    setBlob(null);
    setPhase("done");
    history.replaceState(null, "", location.pathname); // Schlüssel aus der Adresszeile/History nehmen
  };

  async function show() {
    if (!key) return setError("missingKey"); // nie abrufen, wenn der Schlüssel fehlt: sonst wäre das Secret weg
    if (phase !== "idle") return; // Doppelklick: ein Abruf reicht
    setError(null);
    setPhase("loading");
    try {
      // POST, nicht GET: Link-Vorschau-Bots rufen nur GET auf und verbrauchen nichts.
      const res = await fetch(`/api/v1/secrets/${id}/reveal`, { method: "POST", headers: { "accept-language": locale } });
      if (!res.ok) {
        setPhase("idle");
        if (res.status === 404) {
          const reason = ((await res.json().catch(() => ({}))) as { reason?: string }).reason;
          return setError(reason === "opened" ? "goneOpened" : reason === "expired" ? "goneExpired" : reason === "reported" ? "goneReported" : reason === "revoked" ? "goneRevoked" : "gone");
        }
        return setError(res.status === 429 ? "rateLimited" : "generic");
      }
      const { ciphertext } = (await res.json()) as { ciphertext: string };
      if (needsPassword(ciphertext)) {
        setBlob(ciphertext);
        return setPhase("password");
      }
      finish(await decrypt(ciphertext, key));
    } catch (e) {
      setPhase("idle");
      setError(e instanceof CryptoError ? "corrupt" : "generic");
    }
  }

  async function unlock(e: React.FormEvent) {
    e.preventDefault();
    if (!blob || !key) return;
    try {
      finish(await decrypt(blob, key, password));
    } catch (err) {
      setError(err instanceof CryptoError && err.reason === "wrong-key-or-password" ? "wrongPassword" : "corrupt");
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(secret);
      setCopied(true);
    } catch {
      /* Clipboard nicht erlaubt: Nutzer kann den Text markieren */
    }
  }

  // Zu viele Abrufe: Knopf sperren, bis das Limit des Servers (1 Minute) vorbei ist, dann verschwindet die Meldung von selbst.
  useEffect(() => {
    if (error !== "rateLimited") return;
    const timer = setTimeout(() => setError(null), 60_000);
    return () => clearTimeout(timer);
  }, [error]);

  const shownError = error ?? (key === "" ? "missingKey" : null);
  // Diese Fehler sind endgültig (Link weg, kein Schlüssel, Inhalt schon abgerufen): erneut klicken kann nichts mehr ändern.
  const final = shownError !== null && shownError !== "rateLimited" && shownError !== "generic";

  if (phase === "done") {
    return (
      <section className="reveal">
        <div className="field">
          <label htmlFor="secret">{t("secretLabel")}</label>
          <textarea id="secret" readOnly value={secret} rows={8} onFocus={(e) => e.currentTarget.select()} />
        </div>
        <button type="button" className="primary copy-btn" onClick={copy}>{copied ? <Check size={18} aria-hidden="true" /> : <Copy size={18} aria-hidden="true" />}{copied ? t("copied") : t("copy")}</button>
        <Msg kind="ok">{t("deleted")}</Msg>
      </section>
    );
  }

  if (phase === "password") {
    return (
      <form onSubmit={unlock} className="reveal">
        <p className="lead-s">{t("passwordHint")}</p>
        <div className="field">
          <label htmlFor="pw">{t("passwordLabel")}</label>
          <input id="pw" type="password" autoComplete="off" autoFocus value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        <button type="submit" className="primary">{t("passwordSubmit")}</button>
        {shownError && <Msg kind="err">{t(`errors.${shownError}`)}</Msg>}
      </form>
    );
  }

  return (
    <section className="reveal">
      {shownError ? <Msg kind="err">{t(`errors.${shownError}`)}</Msg> : <p className="lead-s">{t("warning")}</p>}
      {!final && <button type="button" className="primary" onClick={show} disabled={phase === "loading" || shownError === "rateLimited"}>{phase === "loading" ? t("loading") : t("show")}</button>}
      {!final && <p className="after"><small><Link href={`/s/${id}/report`}>{t("reportLink")}</Link></small></p>}
    </section>
  );
}
