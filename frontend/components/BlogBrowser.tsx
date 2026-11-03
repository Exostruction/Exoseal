"use client";

import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { BlogCard, type CardPost } from "@/components/BlogCard";

type Labels = { search: string; all: string; empty: string; read: string; count: string };

// Suche und Filter über den Beiträgen. Alle Karten stehen schon im ersten HTML, gefiltert wird nur im Browser.
export function BlogBrowser({ posts, wanted, labels }: { posts: CardPost[]; wanted: string; labels: Labels }) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const cats = useMemo(() => [...new Set(posts.flatMap((p) => p.categories).filter((c) => c.toLowerCase() !== wanted.toLowerCase()))], [posts, wanted]);
  const needle = q.trim().toLowerCase();
  const shown = posts.filter((p) => (!cat || p.categories.includes(cat)) && (!needle || `${p.title} ${p.summary}`.toLowerCase().includes(needle)));
  return (
    <>
      <div className="gb-tools">
        <label className="gb-search">
          <Search size={18} strokeWidth={1.75} aria-hidden="true" />
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={labels.search} aria-label={labels.search} />
        </label>
        {cats.length > 0 && (
          <div className="gb-chips" role="group">
            <button type="button" aria-pressed={cat === ""} onClick={() => setCat("")}>{labels.all}</button>
            {cats.map((c) => <button key={c} type="button" aria-pressed={cat === c} onClick={() => setCat(c)}>{c}</button>)}
          </div>
        )}
      </div>
      <p className="fb-count" role="status">{labels.count.replace("{n}", String(shown.length))}</p>
      {shown.length === 0 ? (
        <p className="gb-empty">{labels.empty}</p>
      ) : (
        <ul className="bp bp4">
          {shown.map((p) => <BlogCard key={p.url} post={p} read={labels.read} sizes="(min-width: 64rem) 22vw, (min-width: 40rem) 45vw, 100vw" />)}
        </ul>
      )}
    </>
  );
}
