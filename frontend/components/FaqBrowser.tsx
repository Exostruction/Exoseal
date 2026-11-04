"use client";

import { Search } from "lucide-react";
import { useMemo, useState } from "react";

type Item = { key: string; q: string; a: string; cat: string };
type Labels = { search: string; all: string; empty: string; count: string };

// Suche und Filter für die FAQ-Seite. Alle Fragen stehen im ersten HTML, gefiltert wird nur im Browser.
export function FaqBrowser({ items, labels }: { items: Item[]; labels: Labels }) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const cats = useMemo(() => [...new Set(items.map((i) => i.cat))], [items]);
  const needle = q.trim().toLowerCase();
  const shown = items.filter((i) => (!cat || i.cat === cat) && (!needle || `${i.q} ${i.a}`.toLowerCase().includes(needle)));
  return (
    <>
      <div className="gb-tools">
        <label className="gb-search">
          <Search size={18} strokeWidth={1.75} aria-hidden="true" />
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={labels.search} aria-label={labels.search} />
        </label>
        <div className="gb-chips" role="group">
          <button type="button" aria-pressed={cat === ""} onClick={() => setCat("")}>{labels.all}</button>
          {cats.map((c) => (
            <button key={c} type="button" aria-pressed={cat === c} onClick={() => setCat(c)}>{c}</button>
          ))}
        </div>
      </div>
      <p className="fb-count" role="status">{labels.count.replace("{n}", String(shown.length))}</p>
      {shown.length === 0 ? (
        <p className="gb-empty">{labels.empty}</p>
      ) : (
        <div className="fb">
          {shown.map((i) => (
            <details key={i.key}>
              <summary>
                <span className="fb-t">
                  <small><i aria-hidden="true" />{i.cat}</small>
                  <b>{i.q}</b>
                </span>
                <svg className="fb-plus" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden="true">
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <line className="v" x1="12" y1="5" x2="12" y2="19" />
                </svg>
              </summary>
              <p>{i.a}</p>
            </details>
          ))}
        </div>
      )}
    </>
  );
}
