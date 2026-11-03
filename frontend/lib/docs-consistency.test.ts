import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { test } from "node:test";

// Hält Einstellungen, Compose-Datei, Doku und Anleitungen zusammen: Wer eine Einstellung ändert und eine Stelle vergisst, bekommt hier einen Fehler.
const root = new URL("../../", import.meta.url);
const read = (p: string) => readFileSync(new URL(p, root), "utf8");
const files = (dir: string, ext: string): string[] =>
  readdirSync(new URL(dir, root)).flatMap((f) => {
    const rel = `${dir}/${f}`;
    return statSync(new URL(rel, root)).isDirectory() ? files(rel, ext) : rel.endsWith(ext) ? [rel] : [];
  });

const example = read(".env.example");
const compose = read("docker-compose.yml");
const exampleKeys = new Set([...example.matchAll(/^#?\s*([A-Z][A-Z0-9_]+)=/gm)].map((m) => m[1]));
const composeVars = new Set([...compose.matchAll(/\$\{([A-Z][A-Z0-9_]+)/g)].map((m) => m[1]));

test("Jede Variable der Compose-Datei steht in .env.example", () => {
  const missing = [...composeVars].filter((v) => !exampleKeys.has(v));
  assert.deepEqual(missing, [], `fehlen in .env.example: ${missing.join(", ")}`);
});

test("Jede Einstellung in .env.example wird von der Compose-Datei durchgereicht", () => {
  const dead = [...exampleKeys].filter((k) => !composeVars.has(k));
  assert.deepEqual(dead, [], `ungenutzt: ${dead.join(", ")}`);
});

test("Alles, was das Frontend aus der Umgebung liest, wird ihm in der Compose-Datei mitgegeben", () => {
  const block = compose.split(/\n {2}(?=[a-z-]+:\n)/).find((b) => b.startsWith("frontend:")) ?? "";
  const given = new Set([...block.matchAll(/^\s{6}([A-Z][A-Z0-9_]+):/gm)].map((m) => m[1]));
  const used = new Set<string>();
  for (const f of [...files("frontend/app", ".tsx"), ...files("frontend/app", ".ts"), ...files("frontend/lib", ".ts"), ...files("frontend/components", ".tsx"), "frontend/proxy.ts"]) {
    if (f.endsWith(".test.ts")) continue;
    for (const m of read(f).matchAll(/\b(?:process\.)?env\.([A-Z][A-Z0-9_]+)/g)) used.add(m[1]);
  }
  used.delete("NODE_ENV");
  const missing = [...used].filter((v) => !given.has(v));
  assert.deepEqual(missing, [], `Frontend liest, bekommt aber nichts: ${missing.join(", ")}`);
});

test("Einstellungen, die Anleitungen und Doku nennen, gibt es wirklich", () => {
  // Großgeschriebene Namen mit Unterstrich, auch als Muster wie SMTP_*; nicht dazu zählen Begriffe, die keine Einstellung sind.
  const NOT_SETTINGS = new Set(["AES_256_GCM"]);
  const texts: [string, string][] = [
    ...["de", "en"].flatMap((l) => ["guides", "pages", "legal", "landing", "common"].map((n): [string, string] => [`messages/${l}/${n}.json`, read(`frontend/messages/${l}/${n}.json`)])),
    ...files("docs", ".md").map((f): [string, string] => [f, read(f)]),
  ];
  const problems: string[] = [];
  for (const [file, text] of texts) {
    for (const m of text.matchAll(/\b([A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+)(_\*)?/g)) {
      const name = m[1];
      if (NOT_SETTINGS.has(name)) continue;
      const known = m[2] ? [...exampleKeys].some((k) => k.startsWith(`${name}_`)) : exampleKeys.has(name) || [...exampleKeys].some((k) => k.startsWith(`${name}_`));
      if (!known) problems.push(`${file}: ${name}${m[2] ?? ""}`);
    }
  }
  assert.deepEqual([...new Set(problems)], [], "Diese Namen kommen in Text oder Doku vor, aber nicht in .env.example");
});

test("Die erlaubten Werte von PRIVACY_SERVICES stehen im Kommentar der .env.example", () => {
  const src = read("frontend/app/[locale]/(site)/privacy/page.tsx");
  const values = [...(src.match(/const KNOWN = \[([^\]]+)\]/)?.[1] ?? "").matchAll(/"([a-z]+)"/g)].map((m) => m[1]);
  assert.ok(values.length >= 3, "KNOWN nicht gefunden");
  for (const v of values) assert.ok(example.includes(v), `${v} fehlt im Kommentar zu PRIVACY_SERVICES`);
});

test("Die Texte jedes erlaubten Dienstleisters gibt es in beiden Sprachen", () => {
  for (const l of ["de", "en"]) {
    const d = JSON.parse(read(`frontend/messages/${l}/legal.json`)).privacy.services;
    for (const k of ["cloudflare", "crowdsec", "crowdsecshare"]) assert.ok(d[k]?.title && d[k]?.text, `${l}: ${k}`);
  }
});

test("Jeder Eintrag im Änderungsprotokoll hat Version und Datum, und die neueste Version ist die in package.json", () => {
  const pkg = JSON.parse(read("frontend/package.json")) as { version: string };
  for (const l of ["de", "en"]) {
    const items = JSON.parse(read(`frontend/messages/${l}/pages.json`)).changelog.items as Record<string, { version: string; date: string }>;
    for (const [k, v] of Object.entries(items)) {
      assert.match(v.version, /^\d+\.\d+\.\d+$/, `${l} ${k}: Version`);
      assert.match(v.date, /^\d{4}-\d{2}-\d{2}$/, `${l} ${k}: Datum`);
    }
    const newest = Object.values(items).map((v) => v.version).sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))[0];
    assert.equal(newest, pkg.version, `${l}: package.json (${pkg.version}) passt nicht zum neuesten Eintrag (${newest})`);
  }
});

test("Jede Anleitung nennt Datum, Tag und mindestens eine Frage, in beiden Sprachen", () => {
  for (const l of ["de", "en"]) {
    const items = JSON.parse(read(`frontend/messages/${l}/guides.json`)).items as Record<string, { updated: string; tag: string; faq: Record<string, unknown> }>;
    for (const [slug, g] of Object.entries(items)) {
      assert.match(g.updated, /^\d{4}-\d{2}-\d{2}$/, `${l} ${slug}: updated`);
      assert.ok(g.tag, `${l} ${slug}: tag`);
      assert.ok(Object.keys(g.faq).length >= 1, `${l} ${slug}: faq`);
    }
  }
});

