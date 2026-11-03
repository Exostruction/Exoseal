// Läuft mit `yarn test` (Node-Testrunner, keine Zusatzpakete).
import assert from "node:assert/strict";
import { test } from "node:test";
import { CryptoError, MAX_PLAINTEXT_BYTES, decrypt, encrypt, fromB64u, needsPassword, toB64u } from "./crypto.ts";

const reason = (r: string) => (e: unknown) => e instanceof CryptoError && e.reason === r;

test("Roundtrip, auch mit Unicode", async () => {
  const text = "pässwörd 🔑 日本語\nzweite Zeile";
  const { blob, key } = await encrypt(text);
  assert.equal(await decrypt(blob, key), text);
});

test("Roundtrip mit Passwort; ohne oder mit falschem Passwort scheitert es", async () => {
  const { blob, key } = await encrypt("geheim", "pw1");
  assert.equal(needsPassword(blob), true);
  assert.equal(await decrypt(blob, key, "pw1"), "geheim");
  await assert.rejects(decrypt(blob, key, "pw2"), reason("wrong-key-or-password"));
  await assert.rejects(decrypt(blob, key), reason("wrong-key-or-password"));
});

test("Ohne Passwort-Flag: kein Passwort nötig", async () => {
  assert.equal(needsPassword((await encrypt("x")).blob), false);
});

test("Falscher Schlüssel scheitert", async () => {
  const a = await encrypt("x");
  const b = await encrypt("x");
  await assert.rejects(decrypt(a.blob, b.key), reason("wrong-key-or-password"));
  await assert.rejects(decrypt(a.blob, "zu-kurz"), reason("invalid-key"));
});

test("Manipulierter Blob scheitert (Chiffretext und Header)", async () => {
  const { blob, key } = await encrypt("x");
  const flip = (i: number) => { const b = fromB64u(blob); b[i] ^= 1; return toB64u(b); };
  await assert.rejects(decrypt(flip(40), key), reason("wrong-key-or-password"));   // Chiffretext
  await assert.rejects(decrypt(flip(1), key), reason("wrong-key-or-password"));    // Flags (AAD)
  await assert.rejects(decrypt(flip(0), key), reason("invalid-blob"));             // Version
  await assert.rejects(decrypt("AAAA", key), reason("invalid-blob"));              // zu kurz
});

test("Jede Verschlüsselung ist anders (Zufalls-Schlüssel, Salt, IV)", async () => {
  const a = await encrypt("gleich");
  const b = await encrypt("gleich");
  assert.notEqual(a.blob, b.blob);
  assert.notEqual(a.key, b.key);
});

test("Größenlimit", async () => {
  await encrypt("a".repeat(MAX_PLAINTEXT_BYTES));
  await assert.rejects(encrypt("a".repeat(MAX_PLAINTEXT_BYTES + 1)), RangeError);
});

test("Blob passt in die Server-Grenzen (46 B bis 64 KiB)", async () => {
  const min = fromB64u((await encrypt("")).blob).length;
  const max = fromB64u((await encrypt("a".repeat(MAX_PLAINTEXT_BYTES), "pw")).blob).length;
  assert.equal(min, 46);
  assert.ok(max <= 64 * 1024);
});
