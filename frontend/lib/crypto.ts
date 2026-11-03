// Ende-zu-Ende-Verschlüsselung im Browser (Web Crypto). Der Server sieht nur den Blob, nie den Schlüssel.
//
// Blob v1:  [version=1][flags][salt 16][iv 12][AES-GCM-Chiffretext+Tag]
// Schlüssel: zufällige 32 Byte (landen im URL-Fragment). Mit Passwort zusätzlich PBKDF2(passwort, salt).
//            AES-Key = HKDF-SHA256(secret [|| pbkdf2], salt). Header (version, flags) ist als AAD authentifiziert.

const VERSION = 1;
const FLAG_PASSWORD = 1;
const SALT = 16;
const IV = 12;
const PBKDF2_ITERATIONS = 600_000; // OWASP-Empfehlung für PBKDF2-HMAC-SHA256

export const MAX_PLAINTEXT_BYTES = 50_000;

type Bytes = Uint8Array<ArrayBuffer>;
const enc = new TextEncoder();
const dec = new TextDecoder("utf-8", { fatal: true });

export class CryptoError extends Error {
  reason: "invalid-blob" | "invalid-key" | "wrong-key-or-password";
  constructor(reason: CryptoError["reason"]) { // keine Parameter-Property: Node-Testrunner entfernt nur Typen
    super(reason);
    this.reason = reason;
  }
}

export function toB64u(b: Uint8Array): string {
  let s = "";
  for (const x of b) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function fromB64u(s: string): Bytes {
  if (!/^[A-Za-z0-9_-]*$/.test(s)) throw new CryptoError("invalid-blob");
  const p = s.replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(p + "=".repeat((4 - (p.length % 4)) % 4)), (c) => c.charCodeAt(0));
}

function concat(...parts: Uint8Array[]): Bytes {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

async function aesKey(secret: Bytes, password: string | undefined, salt: Bytes): Promise<CryptoKey> {
  let ikm = secret;
  if (password) {
    const pk = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
    const bits = new Uint8Array(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: PBKDF2_ITERATIONS }, pk, 256));
    ikm = concat(secret, bits);
  }
  const base = await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt, info: enc.encode("exoseal v1") },
    base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"],
  );
}

/** Verschlüsselt. `blob` geht zum Server, `key` gehört ins URL-Fragment. */
export async function encrypt(plaintext: string, password?: string): Promise<{ blob: string; key: string }> {
  const data = enc.encode(plaintext);
  if (data.length > MAX_PLAINTEXT_BYTES) throw new RangeError("plaintext too large");
  const secret = crypto.getRandomValues(new Uint8Array(32));
  const salt = crypto.getRandomValues(new Uint8Array(SALT));
  const iv = crypto.getRandomValues(new Uint8Array(IV));
  const header = new Uint8Array([VERSION, password ? FLAG_PASSWORD : 0]);
  const ct = new Uint8Array(await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: header }, await aesKey(secret, password, salt), data));
  return { blob: toB64u(concat(header, salt, iv, ct)), key: toB64u(secret) };
}

function parse(blob: string) {
  const b = fromB64u(blob);
  if (b.length < 2 + SALT + IV + 16 || b[0] !== VERSION) throw new CryptoError("invalid-blob");
  return { header: b.slice(0, 2), flags: b[1], salt: b.slice(2, 2 + SALT), iv: b.slice(2 + SALT, 2 + SALT + IV), ct: b.slice(2 + SALT + IV) };
}

/** Braucht der Blob ein Passwort? (vor dem Entschlüsseln fragen, ohne etwas zu verbrauchen) */
export const needsPassword = (blob: string): boolean => (parse(blob).flags & FLAG_PASSWORD) !== 0;

export async function decrypt(blob: string, key: string, password?: string): Promise<string> {
  const p = parse(blob);
  let secret: Bytes;
  try { secret = fromB64u(key); } catch { throw new CryptoError("invalid-key"); }
  if (secret.length !== 32) throw new CryptoError("invalid-key");
  if ((p.flags & FLAG_PASSWORD) !== 0 && !password) throw new CryptoError("wrong-key-or-password");
  try {
    const pt = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: p.iv, additionalData: p.header },
      await aesKey(secret, (p.flags & FLAG_PASSWORD) !== 0 ? password : undefined, p.salt), p.ct);
    return dec.decode(pt);
  } catch {
    throw new CryptoError("wrong-key-or-password");
  }
}
