import { ChevronDown } from "lucide-react";
import { getTranslations } from "next-intl/server";

type QA = { q: string; a: string };

// Fragenliste mit sanftem Aufklappen (reines HTML, ohne Skript). Startseite, Anleitungen.
export function FaqAccordion({ items, openFirst = true }: { items: QA[]; openFirst?: boolean }) {
  return (
    <div className="fq">
      {items.map((it, i) => (
        <details key={it.q} open={openFirst && i === 0}>
          <summary>
            <span>{String(i + 1).padStart(2, "0")}</span>{it.q}
            <ChevronDown size={18} strokeWidth={2} aria-hidden="true" />
          </summary>
          <p>{it.a}</p>
        </details>
      ))}
    </div>
  );
}

export async function FaqList({ keys }: { keys: readonly string[] }) {
  const l = await getTranslations("landing");
  return <FaqAccordion items={keys.map((q) => ({ q: l(`faq.${q}.q` as never), a: l(`faq.${q}.a` as never) }))} />;
}
