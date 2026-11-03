"use client";

import { Check, Flame, Link2, Lock, LockOpen } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

// Hero-Animation: eine einzige Fläche. Tippen, zu Punkten verschlüsseln, Link, entschlüsseln, löschen.
// Alles nur gespielt, nichts geht ins Netz.
// Ohne `step` läuft sie als Schleife im Hero. Mit `step` (0 bis 2) spielt sie nur den passenden Abschnitt (Scroll-Abschnitt "So funktioniert es"), -1 = wartet.

type Phase = "type" | "seal" | "link" | "open" | "gone";
type Cell = [char: string, cipher: boolean];
type S = { step: number; phase: Phase; typed: number; shown: Cell[]; locked: boolean; ready: boolean; flame: boolean; msg: boolean };

const INIT: S = { step: 0, phase: "type", typed: 0, shown: [], locked: false, ready: false, flame: false, msg: false };
const STATIC: S = { step: 2, phase: "link", typed: 999, shown: [], locked: true, ready: true, flame: false, msg: false };
const HOST = "seal.exoseal.com/s/8fK2xQ";
const KEY = "#vT2mLw0Pz3H";

const REDUCED = "(prefers-reduced-motion: reduce)";
const onReduced = (cb: () => void) => { const m = window.matchMedia(REDUCED); m.addEventListener("change", cb); return () => m.removeEventListener("change", cb); };
const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
const rnd = (n: number) => Array.from({ length: Math.max(0, n) }, () => CHARS[Math.floor(Math.random() * CHARS.length)]).join("");

const cells = (c: Cell[]) => c.map(([ch, enc], i) => (enc ? <span key={i} className="hs-cipher">{ch}</span> : <span key={i}>{ch}</span>));
const STEPS = ["s1", "s2", "s3", "s4", "s5"] as const;
const STEPS3 = ["s1", "s2", "s3"] as const;

export function HeroStage({ step }: { step?: number }) {
  const fit = step !== undefined;
  const cipherRef = useRef("");
  const t = useTranslations("landing.stage");
  const reduced = useSyncExternalStore(onReduced, () => window.matchMedia(REDUCED).matches, () => false);
  const [live, setLive] = useState<S>(INIT);
  const note = t("note");
  const cur3 = step ?? -1;

  useEffect(() => {
    if (reduced) return;
    let alive = true;
    const w = (ms: number) => new Promise<void>((res, rej) => setTimeout(() => (alive ? res() : rej(new Error("stop"))), ms));
    const patch = (p: Partial<S>) => setLive((v) => ({ ...v, ...p }));
    // Welle von links nach rechts: jedes Zeichen wirbelt kurz durch Zufallsbuchstaben und setzt sich dann.
    // Pro Frame neu berechnet (rAF), Farbe wechselt pro Zeichen, dadurch läuft alles weich.
    const wave = (from: string, to: string, toCipher: boolean, ms: number) =>
      new Promise<void>((res, rej) => {
        const n = to.length, per = 420, stagger = (ms - per) / Math.max(1, n - 1);
        const slot = new Array<number>(n).fill(-1), spin = Array.from({ length: n }, () => rnd(1));
        const t0 = performance.now();
        let last = "";
        const tick = (now: number) => {
          if (!alive) return rej(new Error("stop"));
          const el = now - t0;
          const out: Cell[] = [];
          for (let i = 0; i < n; i++) {
            const st = i * stagger;
            if (el < st) out.push([from[i], !toCipher]);
            else if (el < st + per) {
              const sl = Math.floor((el + i * 17) / 60);
              if (sl !== slot[i]) { slot[i] = sl; spin[i] = rnd(1); }
              out.push([spin[i], true]);
            } else out.push([to[i], toCipher]);
          }
          const key = out.map((c) => c[0] + (c[1] ? 1 : 0)).join("");
          if (key !== last) { last = key; patch({ shown: out }); }
          if (el >= ms) res(); else requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });

    const sealed = (): Cell[] => [...cipherRef.current].map((c): Cell => [c, true]);
    async function seq(k: number) {
      const cipher = cipherRef.current;
      if (k === 0) {
        setLive(INIT);
        await w(500);
        for (let i = 1; i <= note.length; i++) { patch({ typed: i }); await w(55 + Math.random() * 65); }
        await w(700);
        patch({ step: 1, phase: "seal", shown: [...note].map((c): Cell => [c, false]) });
        setTimeout(() => alive && patch({ locked: true }), 900);
        await wave(note, cipher, true, 1300);
        patch({ shown: sealed() });
      } else if (k === 1) {
        setLive({ ...INIT, step: 2, phase: "link", locked: true });
      } else {
        setLive({ ...INIT, step: 3, phase: "open", locked: true, shown: sealed() });
        await w(600);
        await wave(cipher, note, false, 1300);
        patch({ ready: true });
        await w(1800);
        patch({ step: 4, phase: "gone", shown: [...note].map((c): Cell => [c, false]) });
        setTimeout(() => alive && patch({ flame: true }), 600);
        await wave(note, " ".repeat(note.length), true, 1300);
        await w(250);
        patch({ msg: true });
      }
    }

    async function run() {
      while (alive) {
        setLive(INIT);
        const cipher = cipherRef.current;
        await w(1100);
        for (let i = 1; i <= note.length; i++) { patch({ typed: i }); await w(55 + Math.random() * 65); }
        await w(900);
        patch({ step: 1, phase: "seal", shown: [...note].map((c): Cell => [c, false]) });
        setTimeout(() => alive && patch({ locked: true }), 900);
        await wave(note, cipher, true, 1300);
        await w(1500);
        patch({ step: 2, phase: "link" });
        await w(3600);
        patch({ step: 3, phase: "open", shown: [...cipher].map((c): Cell => [c, true]), ready: false });
        await w(700);
        await wave(cipher, note, false, 1300);
        patch({ ready: true });
        await w(2300);
        patch({ step: 4, phase: "gone", shown: [...note].map((c): Cell => [c, false]) });
        setTimeout(() => alive && patch({ flame: true }), 600);
        await wave(note, " ".repeat(note.length), true, 1300);   // Zeichen wirbeln auf und lösen sich auf
        await w(250);
        patch({ msg: true });
        await w(3200);
      }
    }
    cipherRef.current = rnd(note.length);
    if (step === undefined) run().catch(() => {});
    else if (step >= 0) seq(step).catch(() => {});
    return () => { alive = false; };
  }, [reduced, note, step]);

  const s = reduced ? STATIC : live;
  const typing = s.phase === "type" && s.typed < note.length;
  const open = s.phase === "open";
  const opened = open && s.ready;

  let text: React.ReactNode;
  if (s.phase === "type") text = <>{note.slice(0, s.typed)}{typing && <i className="hs-caret" />}{s.typed === 0 && <span className="hs-ph">{t("placeholder")}</span>}</>;
  else if (s.phase === "seal") text = cells(s.shown);
  else if (s.phase === "link") text = <><span className="hs-host">{HOST}</span><b className="hs-key">{KEY}</b></>;
  else if (open) text = cells(s.shown);
  else text = s.msg ? <span className="hs-goneText">{t("goneText")}</span> : cells(s.shown);

  const ic = s.phase === "type" ? "open" : s.phase === "seal" ? (s.locked ? "lock" : "open") : s.phase === "link" ? "link" : open ? (opened ? "open" : "lock") : s.flame ? "flame" : "open";
  const tag = s.phase === "seal" && s.locked ? t("chipSealed") : s.phase === "link" ? t("chipLink") : opened ? t("chipOpened") : s.phase === "gone" && s.msg ? t("chipGone") : null;

  return (
    <figure className={fit ? "hs hs-fit" : "hs"}>
      <div className={`hs-box ph-${s.phase}`} role="img" aria-label={t("alt")}>
        <div className="hs-row" aria-hidden="true">
          <span className={`hs-ico${ic === "lock" && s.phase === "seal" ? " locked" : s.phase === "link" || s.phase === "gone" || open ? " tint" : ""}`}>
            <LockOpen size={24} className={ic === "open" ? "on" : ""} /><Lock size={24} className={ic === "lock" ? "on" : ""} /><Link2 size={24} className={ic === "link" ? "on" : ""} /><Flame size={24} className={ic === "flame" ? "on" : ""} />
          </span>
          <span className="hs-txt" key={s.phase === "link" ? "link" : s.phase === "gone" && s.msg ? "msg" : "live"}>{text}</span>
          {tag && <span className="hs-tag" key={tag}>{tag}</span>}
        </div>
        <div className={`hs-legend${s.phase === "link" ? " show" : ""}`} aria-hidden="true">
          <span className="a">{t("serverSees")}</span><span className="b">{t("keyStays")}</span>
        </div>
      </div>

      {fit && (
        <ol className="hs-steps hs-steps3" aria-hidden="true">
          {STEPS3.map((k, i) => (
            <li key={k} className={i < cur3 ? "done" : i === cur3 ? "now" : ""}>{i < cur3 && <Check size={12} strokeWidth={3} />}{t(`steps3.${k}`)}</li>
          ))}
        </ol>
      )}
      {!fit && <ol className="hs-steps" aria-hidden="true">
        {STEPS.map((k, i) => (
          <li key={k} className={i < s.step ? "done" : i === s.step ? "now" : ""}>{i < s.step && <Check size={12} strokeWidth={3} />}{t(`steps.${k}`)}</li>
        ))}
      </ol>}
    </figure>
  );
}
