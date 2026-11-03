import { JsonLd } from "@/components/JsonLd";
import { Link } from "@/i18n/navigation";
import { siteUrl } from "@/lib/site";

// Brotkrumen sichtbar und als strukturierte Daten. Das letzte Element ist die aktuelle Seite und nicht verlinkt.
export function Breadcrumbs({ locale, items }: { locale: string; items: { name: string; path: string }[] }) {
  const base = siteUrl();
  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: items.map((it, i) => ({ "@type": "ListItem", position: i + 1, name: it.name, item: `${base}/${locale}${it.path}` })),
        }}
      />
      <nav className="crumbs" aria-label="Breadcrumb">
        <ol>
          {items.map((it, i) => (
            <li key={it.path}>{i < items.length - 1 ? <Link href={it.path as "/"}>{it.name}</Link> : <span aria-current="page">{it.name}</span>}</li>
          ))}
        </ol>
      </nav>
    </>
  );
}
