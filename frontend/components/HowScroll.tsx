"use client";

import { Accent } from "@/components/Accent";
import { Check } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { HeroStage } from "@/components/HeroStage";

// Links bleibt die Fläche aus dem Hero stehen und spielt den Schritt, der rechts gerade im Bild ist.
// Rechts laufen Titel, Text und die drei Schritte durch.

type Item = { label: string; title: string; text: string; more: string; points: string[] };

export function HowScroll({ eyebrow, title, lead, items }: { eyebrow: string; title: string; lead: string; items: Item[] }) {
  const root = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState(0);
  const [seen, setSeen] = useState(false);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const arts = Array.from(el.querySelectorAll<HTMLElement>("[data-i]"));
    // Erst nach einem kurzen Moment umschalten, damit schnelles Scrollen die Animation nicht ständig neu startet.
    let timer: ReturnType<typeof setTimeout> | undefined;
    const io = new IntersectionObserver(
      (es) => es.forEach((e) => {
        if (!e.isIntersecting) return;
        const i = Number((e.target as HTMLElement).dataset.i);
        clearTimeout(timer);
        timer = setTimeout(() => setStep(i), 220);
      }),
      { rootMargin: "-40% 0px -40% 0px" },
    );
    const vis = new IntersectionObserver((es) => setSeen(es[0].isIntersecting), { threshold: 0.25 });
    arts.forEach((a) => io.observe(a));
    vis.observe(el);
    return () => { io.disconnect(); vis.disconnect(); clearTimeout(timer); };
  }, []);

  return (
    <div className="how" ref={root}>
      <div className="how-l"><div className="how-stick"><HeroStage step={seen ? step : -1} /></div></div>
      <div className="how-r">
        <div className="how-head">
          <span className="eyebrow">{eyebrow}</span>
          <h2><Accent text={title} /></h2>
          <p>{lead}</p>
        </div>
        <ol className="how-list">
          {items.map((it, i) => (
            <li key={i} data-i={i} className={i === step ? "on" : ""}>
              <small>{it.label}</small>
              <h3>{it.title}</h3>
              <p>{it.text}</p>
              <p>{it.more}</p>
              <ul>{it.points.map((pt) => <li key={pt}><Check size={18} strokeWidth={2.25} aria-hidden="true" />{pt}</li>)}</ul>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
