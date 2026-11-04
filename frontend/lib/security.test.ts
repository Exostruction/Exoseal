import assert from "node:assert/strict";
import { test } from "node:test";
import { buildCsp } from "./security.ts";

const directive = (csp: string, name: string) => csp.split("; ").find((d) => d.startsWith(`${name} `)) ?? "";

test("CSP: Skripte nur mit Nonce, nie unsafe-inline/eval, keine fremden Quellen", () => {
  const csp = buildCsp("abc123");
  const script = directive(csp, "script-src");
  assert.match(script, /'nonce-abc123'/);
  assert.doesNotMatch(script, /unsafe-inline|unsafe-eval/);
  assert.doesNotMatch(csp, /https?:|\*/); // kein CDN, kein Wildcard
});

test("CSP: Einbetten, Plugins und <base> sind gesperrt", () => {
  const csp = buildCsp("n");
  assert.equal(directive(csp, "frame-ancestors"), "frame-ancestors 'none'");
  assert.equal(directive(csp, "object-src"), "object-src 'none'");
  assert.equal(directive(csp, "base-uri"), "base-uri 'none'");
});

test("CSP: unsafe-eval nur im Dev-Modus, upgrade-insecure-requests nur über https", () => {
  assert.match(directive(buildCsp("n", { dev: true }), "script-src"), /unsafe-eval/);
  assert.doesNotMatch(buildCsp("n"), /upgrade-insecure-requests/);
  assert.match(buildCsp("n", { https: true }), /upgrade-insecure-requests/);
});

test("CSP: jeder Nonce landet im Header", () => {
  assert.notEqual(buildCsp("a"), buildCsp("b"));
});
