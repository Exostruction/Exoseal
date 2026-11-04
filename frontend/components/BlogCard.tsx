import { ArrowUpRight } from "lucide-react";
import { coverSrc, type BlogPost } from "@/lib/blog";

export type CardPost = BlogPost & { dateLabel: string };

// Eine Beitragskarte: Titelbild, Datum und Kategorie, Titel, Kurztext, "Lesen". Der Beitrag selbst liegt beim Herausgeber.
export function BlogCard({ post: p, read, sizes }: { post: CardPost; read: string; sizes: string }) {
  return (
    <li>
      <a href={p.url} rel="noopener" lang="de">
        {p.cover && (
          // eslint-disable-next-line @next/next/no-img-element -- next/image setzt ein Inline-Style, das unsere CSP blockiert
          <img src={coverSrc(p.cover, 640)} srcSet={`${coverSrc(p.cover, 640)} 640w, ${coverSrc(p.cover, 1080)} 1080w`} sizes={sizes} width={640} height={360} alt="" loading="lazy" />
        )}
        <span className="bp-meta">{p.dateLabel && <time dateTime={p.date}>{p.dateLabel}</time>}<span>{p.category}</span></span>
        <b>{p.title}</b>
        <span className="bp-sum">{p.summary}</span>
        <em>{read} <ArrowUpRight size={16} aria-hidden="true" /></em>
      </a>
    </li>
  );
}
