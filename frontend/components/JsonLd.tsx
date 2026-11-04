// Strukturierte Daten für Suchmaschinen und KI-Assistenten. Ein JSON-Block wird nicht ausgeführt, die CSP betrifft ihn nicht.
export function JsonLd({ data }: { data: unknown }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\u003c") }} />;
}
