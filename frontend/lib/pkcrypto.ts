// Public-Key-Verschlüsselung für Anfrage-Links (Web Crypto, ECDH P-256 + HKDF + AES-GCM).
//
// Ersteller: erzeugt im Browser ein Schlüsselpaar. Der Public Key geht an den Server, der Private Key nur
//   verschlüsselt (Passphrase -> PBKDF2 -> AES-GCM). Ohne Passphrase kann der Server ihn nicht benutzen.
// Kunde:     verschlüsselt mit dem Public Key. Ein flüchtiges Schlüsselpaar pro Antwort, nur der Server speichert den Blob.
//
// Wrapped Private Key v1: [version=1][salt 16][iv 12][AES-GCM(PKCS#8)]          AAD = [version]
// Antwort v1:            [version=1][flüchtiger Public Key 65][iv 12][AES-GCM]   AAD = [version][flüchtiger Public Key]
//
// Der Fingerabdruck des Public Keys steht im URL-Fragment des Kunden-Links (der Server sieht ihn nie). Der Browser des
// Kunden vergleicht ihn mit dem Schlüssel vom Server: ein ausgetauschter Schlüssel fällt auf.

import { CryptoError, MAX_PLAINTEXT_BYTES, fromB64u, toB64u } from "./crypto.ts";

const VERSION = 1;
const SALT = 16;
const IV = 12;
const PUBLIC_KEY_BYTES = 65; // unkomprimierter P-256-Punkt
const FINGERPRINT_BYTES = 16;
const PBKDF2_ITERATIONS = 600_000;
export const MIN_PASSPHRASE_LENGTH = 10;

type Bytes = Uint8Array<ArrayBuffer>;
const enc = new TextEncoder();
const dec = new TextDecoder("utf-8", { fatal: true });
const ECDH = { name: "ECDH", namedCurve: "P-256" } as const;

function concat(...parts: Uint8Array[]): Bytes {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

async function passphraseKey(passphrase: string, salt: Bytes): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey("raw", enc.encode(passphrase), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({ name: "PBKDF2", hash: "SHA-256", salt, iterations: PBKDF2_ITERATIONS }, base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}

async function messageKey(privateKey: CryptoKey, peerPublic: CryptoKey, ephemeralPublic: Bytes): Promise<CryptoKey> {
  const shared = await crypto.subtle.deriveBits({ name: "ECDH", public: peerPublic }, privateKey, 256);
  const base = await crypto.subtle.importKey("raw", shared, "HKDF", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt: ephemeralPublic, info: enc.encode("exoseal request v1") },
    base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}

const importPublic = (raw: Bytes) => crypto.subtle.importKey("raw", raw, ECDH, false, []);

export async function fingerprintOf(publicKey: string): Promise<string> {
  const raw = fromB64u(publicKey);
  return toB64u(new Uint8Array(await crypto.subtle.digest("SHA-256", raw)).slice(0, FINGERPRINT_BYTES));
}

/** Ersteller: Schlüsselpaar erzeugen. `fingerprint` kommt in den Kunden-Link, der Rest zum Server. */
export async function createRequestKeys(passphrase: string): Promise<{ publicKey: string; wrappedPrivateKey: string; fingerprint: string }> {
  if (passphrase.length < MIN_PASSPHRASE_LENGTH) throw new RangeError("passphrase too short");
  const pair = await crypto.subtle.generateKey(ECDH, true, ["deriveBits"]);
  const rawPublic = new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey));
  const pkcs8 = new Uint8Array(await crypto.subtle.exportKey("pkcs8", pair.privateKey));

  const salt = crypto.getRandomValues(new Uint8Array(SALT));
  const iv = crypto.getRandomValues(new Uint8Array(IV));
  const header = new Uint8Array([VERSION]);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: header }, await passphraseKey(passphrase, salt), pkcs8));
  pkcs8.fill(0);

  const publicKey = toB64u(rawPublic);
  return { publicKey, wrappedPrivateKey: toB64u(concat(header, salt, iv, ct)), fingerprint: await fingerprintOf(publicKey) };
}

/** Ersteller: Private Key mit der Passphrase freischalten. Wirft "wrong-key-or-password" bei falscher Passphrase. */
export async function unwrapPrivateKey(wrapped: string, passphrase: string): Promise<CryptoKey> {
  const b = fromB64u(wrapped);
  if (b.length < 1 + SALT + IV + 16 || b[0] !== VERSION) throw new CryptoError("invalid-blob");
  const salt = b.slice(1, 1 + SALT);
  const iv = b.slice(1 + SALT, 1 + SALT + IV);
  const ct = b.slice(1 + SALT + IV);
  let pkcs8: Bytes;
  try {
    pkcs8 = new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv, additionalData: b.slice(0, 1) }, await passphraseKey(passphrase, salt), ct));
  } catch {
    throw new CryptoError("wrong-key-or-password");
  }
  try {
    return await crypto.subtle.importKey("pkcs8", pkcs8, ECDH, false, ["deriveBits"]); // nicht extrahierbar
  } catch {
    throw new CryptoError("invalid-blob");
  } finally {
    pkcs8.fill(0);
  }
}

/** Kunde: Antwort für den Public Key verschlüsseln. */
export async function encryptToPublicKey(plaintext: string, publicKey: string): Promise<string> {
  const data = enc.encode(plaintext);
  if (data.length > MAX_PLAINTEXT_BYTES) throw new RangeError("plaintext too large");
  const recipientRaw = fromB64u(publicKey);
  if (recipientRaw.length !== PUBLIC_KEY_BYTES || recipientRaw[0] !== 0x04) throw new CryptoError("invalid-key");
  let recipient: CryptoKey;
  try { recipient = await importPublic(recipientRaw); } catch { throw new CryptoError("invalid-key"); }

  const eph = await crypto.subtle.generateKey(ECDH, true, ["deriveBits"]);
  const ephPublic = new Uint8Array(await crypto.subtle.exportKey("raw", eph.publicKey));
  const iv = crypto.getRandomValues(new Uint8Array(IV));
  const header = concat(new Uint8Array([VERSION]), ephPublic);
  const ct = new Uint8Array(await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: header }, await messageKey(eph.privateKey, recipient, ephPublic), data));
  return toB64u(concat(header, iv, ct));
}

/** Ersteller: Antwort mit dem freigeschalteten Private Key entschlüsseln. */
export async function decryptWithPrivateKey(blob: string, privateKey: CryptoKey): Promise<string> {
  const b = fromB64u(blob);
  if (b.length < 1 + PUBLIC_KEY_BYTES + IV + 16 || b[0] !== VERSION) throw new CryptoError("invalid-blob");
  const header = b.slice(0, 1 + PUBLIC_KEY_BYTES);
  const ephPublic = b.slice(1, 1 + PUBLIC_KEY_BYTES);
  const iv = b.slice(1 + PUBLIC_KEY_BYTES, 1 + PUBLIC_KEY_BYTES + IV);
  const ct = b.slice(1 + PUBLIC_KEY_BYTES + IV);
  try {
    const key = await messageKey(privateKey, await importPublic(ephPublic), ephPublic);
    return dec.decode(await crypto.subtle.decrypt({ name: "AES-GCM", iv, additionalData: header }, key, ct));
  } catch {
    throw new CryptoError("wrong-key-or-password");
  }
}
