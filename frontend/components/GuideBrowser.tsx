"use client";

import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { GuideCard, type GuideCardData } from "@/components/GuideCard";

type Item = GuideCardData;
type Labels = { search: string; all: string; empty: string; eyebrow: string; read: string };

// Suche und Filter über den Anleitungen. Alle Karten stehen schon im ersten HTML (gut für Suchmaschinen), gefiltert wird nur im Browser.
export function GuideBrowser({ items, labels }: { items: Item[]; labels: Labels }) {
  const [q, setQ] = useState("");
  const [tag, setTag] = useState("");
  const tags = useMemo(() => [...new Set(items.map((i) => i.tag))], [items]);
  const needle = q.trim().toLowerCase();
  const shown = items.filter((i) => (!tag || i.tag === tag) && (!needle || `${i.title} ${i.description}`.toLowerCase().includes(needle)));
  return (
    <>
      <div className="gb-tools">
        <label className="gb-search">
          <Search size={18} strokeWidth={1.75} aria-hidden="true" />
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={labels.search} aria-label={labels.search} />
        </label>
        <div className="gb-chips" role="group">
          <button type="button" aria-pressed={tag === ""} onClick={() => setTag("")}>{labels.all}</button>
          {tags.map((t) => (
            <button key={t} type="button" aria-pressed={tag === t} onClick={() => setTag(t)}>{t}</button>
          ))}
        </div>
      </div>
      {shown.length === 0 ? (
        <p className="gb-empty" role="status">{labels.empty}</p>
      ) : (
        <ul className="gc">
          {shown.map((i) => <GuideCard key={i.slug} item={i} eyebrow={labels.eyebrow} read={labels.read} />)}
        </ul>
      )}
    </>
  );
}
