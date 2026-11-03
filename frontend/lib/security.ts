// Content-Security-Policy. Pro Request neuer Nonce (proxy.ts), keine externen Quellen, kein 'unsafe-inline' bei Skripten.

export function buildCsp(nonce: string, opts: { dev?: boolean; https?: boolean } = {}): string {
  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    // 'strict-dynamic': vom Nonce-Skript nachgeladene Chunks sind erlaubt, 'self' wird dann von modernen Browsern ignoriert.
    "script-src": ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'", ...(opts.dev ? ["'unsafe-eval'"] : [])],
    "style-src": ["'self'", `'nonce-${nonce}'`],
    "img-src": ["'self'", "data:"],
    "font-src": ["'self'"],
    "connect-src": ["'self'"],
    "object-src": ["'none'"],
    "base-uri": ["'none'"],
    "form-action": ["'self'"],
    "frame-ancestors": ["'none'"],
  };
  const parts = Object.entries(directives).map(([k, v]) => `${k} ${v.join(" ")}`);
  if (opts.https) parts.push("upgrade-insecure-requests");
  return parts.join("; ");
}
