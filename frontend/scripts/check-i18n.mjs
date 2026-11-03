// Prüft: jede Sprache hat genau die Dateien aus messages/namespaces.json,
// dieselben Schlüssel wie "de" (Referenz) und dieselben {Platzhalter}.
import { readFileSync, readdirSync } from "node:fs";

const root = new URL("../messages/", import.meta.url);
const namespaces = JSON.parse(readFileSync(new URL("namespaces.json", root)));
const locales = readdirSync(root, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
const flat = (o, p = "") => Object.entries(o).flatMap(([k, v]) => (typeof v === "object" ? flat(v, `${p}${k}.`) : [[`${p}${k}`, v]]));
const holders = (s) => [...s.matchAll(/\{(\w+)/g)].map((m) => m[1]).sort().join(",");

const errors = [];
for (const loc of locales) {
  const files = readdirSync(new URL(`${loc}/`, root)).map((f) => f.replace(/\.json$/, "")).sort();
  if (files.join() !== [...namespaces].sort().join()) errors.push(`${loc}: Dateien ${files} != namespaces.json ${namespaces}`);
}
for (const ns of namespaces) {
  const ref = new Map(flat(JSON.parse(readFileSync(new URL(`de/${ns}.json`, root)))));
  for (const loc of locales.filter((l) => l !== "de")) {
    const cur = new Map(flat(JSON.parse(readFileSync(new URL(`${loc}/${ns}.json`, root)))));
    for (const k of ref.keys()) if (!cur.has(k)) errors.push(`${loc}/${ns}: fehlt "${k}"`);
    for (const [k, v] of cur) {
      if (!ref.has(k)) errors.push(`${loc}/${ns}: überflüssig "${k}"`);
      else if (holders(v) !== holders(ref.get(k))) errors.push(`${loc}/${ns}: Platzhalter bei "${k}" weichen ab`);
    }
  }
}
if (errors.length) { console.error(errors.join("\n")); process.exit(1); }
console.log(`i18n ok (${locales.join(", ")})`);
