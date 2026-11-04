import { ArrowRight } from "lucide-react";
import { LogoMark } from "@/components/Logo";
import { Link } from "@/i18n/navigation";

export type GuideCardData = { slug: string; title: string; description: string; tag: string; steps: string };

export function GuideCard({ item, eyebrow, read }: { item: GuideCardData; eyebrow: string; read: string }) {
  return (
    <li>
      <Link href={`/guides/${item.slug}`}>
        <span className="gc-img" aria-hidden="true">
          <small>{eyebrow}</small>
          <b>{item.title}</b>
          <LogoMark size={26} />
        </span>
        <span className="gc-body">
          <small>{item.steps}</small>
          <b>{item.title}</b>
          <span>{item.description}</span>
          <em>{read} <ArrowRight size={16} aria-hidden="true" /></em>
        </span>
      </Link>
    </li>
  );
}
