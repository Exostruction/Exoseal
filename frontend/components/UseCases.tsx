"use client";

import { Accent } from "@/components/Accent";
import { useState } from "react";

// Oben rechts der Kopf (Eyebrow, Titel, Text untereinander), darunter links der Ablauf des gewählten Falls und rechts die Auswahl.

type Item = { title: string; text: string; steps: { role: string; text: string }[] };

export function UseCases({ eyebrow, title, intro, more, items }: { eyebrow: string; title: string; intro: string; more: string; items: Item[] }) {
  const [i, setI] = useState(0);
  const cur = items[i];
  return (
    <div className="uc">
      <div className="head-r">
        <span className="eyebrow">{eyebrow}</span>
        <h2><Accent text={title} /></h2>
        <p className="lead">{intro}</p>
        <p>{more}</p>
      </div>
      <div className="uc-main">
      <div className="uc-det" aria-live="polite">
        <h3>{cur.title}</h3>
        <p>{cur.text}</p>
        <ol>
          {cur.steps.map((s) => (
            <li key={s.role}><small>{s.role}</small><span>{s.text}</span></li>
          ))}
        </ol>
      </div>
      <div className="uc-r">
        <ul>
          {items.map((it, n) => (
            <li key={it.title}>
              <button type="button" aria-pressed={n === i} className={n === i ? "on" : ""} onClick={() => setI(n)}><span className="n" aria-hidden="true">{String(n + 1).padStart(2, "0")}</span>{it.title}</button>
            </li>
          ))}
        </ul>
      </div>
      </div>
    </div>
  );
}
