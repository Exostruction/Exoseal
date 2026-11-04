import assert from "node:assert/strict";
import { test } from "node:test";
import { CryptoError, MAX_PLAINTEXT_BYTES, fromB64u, toB64u } from "./crypto.ts";
import { createRequestKeys, decryptWithPrivateKey, encryptToPublicKey, fingerprintOf, unwrapPrivateKey } from "./pkcrypto.ts";

const PASS = "correct horse battery";
const reason = (r: string) => (e: unknown) => e instanceof CryptoError && e.reason === r;

test("Ganzer Ablauf: Kunde verschlüsselt, Ersteller öffnet mit Passphrase (inkl. Unicode)", async () => {
  const keys = await createRequestKeys(PASS);
  const blob = await encryptToPublicKey("Zugang: pässwörd 🔑\nzweite Zeile", keys.publicKey);
  const priv = await unwrapPrivateKey(keys.wrappedPrivateKey, PASS);
  assert.equal(await decryptWithPrivateKey(blob, priv), "Zugang: pässwörd 🔑\nzweite Zeile");
});

test("Falsche Passphrase scheitert und der Fehler ist eindeutig", async () => {
  const keys = await createRequestKeys(PASS);
  await assert.rejects(unwrapPrivateKey(keys.wrappedPrivateKey, "falsche passphrase!"), reason("wrong-key-or-password"));
});

test("Zu kurze Passphrase wird abgelehnt", async () => {
  await assert.rejects(createRequestKeys("kurz"), RangeError);
});

test("Antwort für Schlüssel A lässt sich nicht mit Schlüssel B öffnen", async () => {
  const a = await createRequestKeys(PASS);
  const b = await createRequestKeys(PASS);
  const blob = await encryptToPublicKey("geheim", a.publicKey);
  await assert.rejects(decryptWithPrivateKey(blob, await unwrapPrivateKey(b.wrappedPrivateKey, PASS)), reason("wrong-key-or-password"));
});

test("Manipulierte Antwort scheitert (Chiffretext, Header, flüchtiger Schlüssel)", async () => {
  const keys = await createRequestKeys(PASS);
  const priv = await unwrapPrivateKey(keys.wrappedPrivateKey, PASS);
  const blob = await encryptToPublicKey("geheim", keys.publicKey);
  const len = fromB64u(blob).length;
  const flip = (i: number) => { const b = fromB64u(blob); assert.ok(i < b.length); b[i] ^= 1; return toB64u(b); }; // i muss im Blob liegen, sonst testet das nichts
  await assert.rejects(decryptWithPrivateKey(flip(len - 1), priv), reason("wrong-key-or-password")); // GCM-Tag
  await assert.rejects(decryptWithPrivateKey(flip(len - 10), priv), reason("wrong-key-or-password")); // Chiffretext
  await assert.rejects(decryptWithPrivateKey(flip(10), priv), reason("wrong-key-or-password"));  // flüchtiger Public Key
  await assert.rejects(decryptWithPrivateKey(flip(0), priv), reason("invalid-blob"));            // Version
  await assert.rejects(decryptWithPrivateKey("AAAA", priv), reason("invalid-blob"));
});

test("Manipulierter verschlüsselter Private Key scheitert", async () => {
  const keys = await createRequestKeys(PASS);
  const b = fromB64u(keys.wrappedPrivateKey);
  b[40] ^= 1;
  await assert.rejects(unwrapPrivateKey(toB64u(b), PASS), reason("wrong-key-or-password"));
});

test("Ausgetauschter Public Key fällt über den Fingerabdruck auf", async () => {
  const real = await createRequestKeys(PASS);
  const attacker = await createRequestKeys(PASS);
  assert.equal(await fingerprintOf(real.publicKey), real.fingerprint);
  assert.notEqual(await fingerprintOf(attacker.publicKey), real.fingerprint);
});

test("Ungültiger Public Key wird abgelehnt", async () => {
  await assert.rejects(encryptToPublicKey("x", toB64u(new Uint8Array(65))), reason("invalid-key"));          // kein 0x04
  await assert.rejects(encryptToPublicKey("x", toB64u(new Uint8Array([4, ...new Uint8Array(64)]))), reason("invalid-key")); // nicht auf der Kurve
  await assert.rejects(encryptToPublicKey("x", "AAAA"), reason("invalid-key"));
});

test("Jede Antwort ist anders (flüchtiger Schlüssel, IV)", async () => {
  const keys = await createRequestKeys(PASS);
  assert.notEqual(await encryptToPublicKey("gleich", keys.publicKey), await encryptToPublicKey("gleich", keys.publicKey));
});

test("Größenlimit und passende Server-Grenzen", async () => {
  const keys = await createRequestKeys(PASS);
  await assert.rejects(encryptToPublicKey("a".repeat(MAX_PLAINTEXT_BYTES + 1), keys.publicKey), RangeError);

  assert.equal(fromB64u(keys.publicKey).length, 65);
  assert.equal(fromB64u(keys.publicKey)[0], 0x04);
  const wrapped = fromB64u(keys.wrappedPrivateKey).length;
  assert.ok(wrapped >= 100 && wrapped <= 1024, `wrapped=${wrapped}`);                                   // Server: 100..1024
  assert.equal(fromB64u(await encryptToPublicKey("", keys.publicKey)).length, 94);                      // Server-Minimum
  assert.ok(fromB64u(await encryptToPublicKey("a".repeat(MAX_PLAINTEXT_BYTES), keys.publicKey)).length <= 64 * 1024); // Server-Maximum
});
