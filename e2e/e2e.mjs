// End-to-End-Test im echten Browser gegen den laufenden Dev-Stack (Anleitung: e2e/README.md).
// Deckt ab: OIDC-Login (Code + PKCE, Allowlist), Secret senden/abrufen, Anfrage-Link (Kunde antwortet, Ersteller öffnet),
// Übersicht mit Filter/Pagination, Mail-Benachrichtigung, Eigentum, Löschen, Logout und CSP-Verstöße.
import { chromium } from "playwright-core";
import { execSync } from "node:child_process";
import { createRequestKeys, encryptToPublicKey } from "../frontend/lib/pkcrypto.ts";

const base = "http://localhost:3000";
const browser = await chromium.launch({ channel: process.env.E2E_BROWSER_CHANNEL ?? "chrome", args: ["--host-resolver-rules=MAP mockidp.localhost 127.0.0.1"] });
let failed = 0;
const log = (ok, msg) => { console.log(`${ok ? "OK  " : "FAIL"} ${msg}`); if (!ok) failed++; };
const violations = [];

async function newPage(label) {
  const ctx = await browser.newContext({ locale: "en-US" });
  const page = await ctx.newPage();
  await page.addInitScript(() => document.addEventListener("securitypolicyviolation", (e) => (window.__v = [...(window.__v ?? []), `${e.violatedDirective} ${e.blockedURI}`])));
  page.label = label;
  return page;
}
const flush = async (page) => {
  try {
    (await page.evaluate(() => window.__v ?? [])).forEach((v) => violations.push(`${page.label}: ${v}`));
    await page.evaluate(() => (window.__v = []));
  } catch { /* Seite wurde gerade gewechselt */ }
};

async function login(page, sub, claims) {
  await page.goto(`${base}/api/v1/auth/login`);
  await page.fill("input[name=username]", sub);
  await page.fill("textarea[name=claims]", JSON.stringify(claims));
  await page.click("input[type=submit]");
  await page.waitForURL(/localhost:3000/);
}

// ---------- A/B: Allowlist ----------
{
  const p = await newPage("allowlist");
  await login(p, "mallory", { email: "mallory@evil.com", email_verified: true });
  await p.waitForSelector("p[role=alert]");
  log(p.url().includes("error=forbidden") && (await p.locator("p[role=alert]").innerText()).includes("has not been approved"), "fremde Domain: Login abgelehnt mit Hinweis");
  log((await p.locator("a.nav-cta[href$='/login']").count()) === 1, "fremde Domain: nicht eingeloggt");
  await p.context().close();

  const q = await newPage("unverified");
  await login(q, "eve", { email: "eve@exostruction.com", email_verified: false });
  await q.waitForSelector("p[role=alert]");
  log(q.url().includes("error=forbidden"), "richtige Domain, aber Mail nicht verifiziert: abgelehnt");
  await q.context().close();
}

// ---------- C: Login als Alice ----------
const alice = await newPage("alice");
await login(alice, "alice-sub", { email: "alice@exostruction.com", email_verified: true, name: "Alice" });
await alice.waitForSelector("text=Signed in as");
log((await alice.locator("main").innerText()).includes("Signed in as alice@exostruction.com"), "Login über OIDC (Code + PKCE) klappt, Nutzer angezeigt");
const session = (await alice.context().cookies()).find((c) => c.name === "exoseal.session");
log(!!session && session.httpOnly && session.sameSite === "Lax" && session.path === "/", "Session-Cookie: HttpOnly, SameSite=Lax, Pfad /");
log(!(await alice.evaluate(() => document.cookie)).includes("exoseal.session"), "Session-Cookie per JavaScript nicht lesbar");
await flush(alice);

// ---------- D: Secret erstellen + abrufen (bisher nie im Browser getestet) ----------
{
  await alice.goto(`${base}/en/new`);
  await alice.fill("#secret", "DB-Passwort: pässwörd 🔑");
  await alice.fill("#label", "E2E Server-Login");
  await alice.selectOption("#ttl", "1h");
  await alice.click("main form:not([action]) button[type=submit]");
  await alice.waitForSelector("input[readonly]");
  const secretLink = await alice.locator("input[readonly]").inputValue();
  log(/\/en\/s\/[0-9a-f-]{36}#.{43}$/.test(secretLink), "Secret-Link erzeugt");
  await flush(alice);
  const anon = await newPage("secret-recipient");
  await anon.goto(secretLink);
  await anon.getByRole("button", { name: "Show secret" }).click();
  await anon.waitForSelector("textarea");
  log((await anon.locator("textarea").inputValue()) === "DB-Passwort: pässwörd 🔑", "Empfänger ohne Login entschlüsselt das Secret");
  await flush(anon);
  // Liste "Gesendet": der Link steht mit seinem Status drin
  await alice.goto(`${base}/en/sent`);
  log((await alice.locator("main").innerText()).includes("E2E Server-Login") && (await alice.locator("main tbody tr").first().innerText()).includes("Opened"), "Gesendet: Link mit Bezeichnung und Status 'Opened'");
  // zweites Öffnen: der Link sagt, dass er schon geöffnet wurde
  await anon.context().close();
  const second = await newPage("secret-second");
  await second.goto(secretLink);
  await second.getByRole("button", { name: "Show secret" }).click();
  await second.waitForSelector(".msg.err");
  log((await second.locator(".msg.err").innerText()).includes("already opened"), "zweites Öffnen: Link nennt den Grund (schon geöffnet)");
  await second.context().close();
  // zurückgezogener Link: Ersteller zieht ihn zurück, der Empfänger erfährt es
  await alice.goto(`${base}/en/new`);
  await alice.fill("#secret", "wird zurückgezogen");
  await alice.fill("#label", "E2E Rückzug");
  await alice.selectOption("#ttl", "1h");
  await alice.click("main form:not([action]) button[type=submit]");
  await alice.waitForSelector("input[readonly]");
  const withdrawLink = await alice.locator("input[readonly]").inputValue();
  await alice.goto(`${base}/en/sent`);
  log((await alice.locator("main tbody tr").first().innerText()).includes("Open"), "Gesendet: neuer Link steht als 'Open' oben");
  await alice.locator("main tbody tr").first().getByRole("button", { name: "Withdraw" }).click();
  await alice.locator("main tbody tr").first().getByRole("button", { name: "Yes, withdraw" }).click();
  await alice.waitForFunction(() => document.querySelector("main tbody tr")?.textContent?.includes("Withdrawn"));
  log(true, "Gesendet: Link zurückgezogen, Status 'Withdrawn'");
  const wd = await newPage("secret-withdrawn");
  await wd.goto(withdrawLink);
  await wd.getByRole("button", { name: "Show secret" }).click();
  await wd.waitForSelector(".msg.err");
  log((await wd.locator(".msg.err").innerText()).includes("withdrew"), "zurückgezogener Link: nennt den Grund (zurückgezogen)");
  await wd.context().close();
  // gemeldeter Link: der Absender sieht, dass gemeldet wurde
  await alice.goto(`${base}/en/new`);
  await alice.fill("#secret", "wird gemeldet");
  await alice.selectOption("#ttl", "1h");
  await alice.click("main form:not([action]) button[type=submit]");
  await alice.waitForSelector("input[readonly]");
  const reportedLink = await alice.locator("input[readonly]").inputValue();
  const rep = await newPage("secret-reporter");
  await rep.goto(reportedLink.replace(/#.*$/, "").replace("/s/", "/s/") + "/report");
  await rep.locator("main button").first().click();
  await rep.waitForTimeout(800);
  await rep.context().close();
  const again = await newPage("secret-again");
  await again.goto(reportedLink);
  await again.getByRole("button", { name: "Show secret" }).click();
  await again.waitForSelector(".msg.err");
  log((await again.locator(".msg.err").innerText()).includes("was reported"), "gemeldeter Link: nennt den Grund (gemeldet)");
  await again.context().close();
}

// ---------- E: Anfrage erstellen ----------
let customerLink, requestId;
const PASS = "my long passphrase 1";
{
  await alice.goto(`${base}/en/requests/new`);
  await alice.fill("#question", "AWS root key");
  await alice.selectOption("#days", "3");
  await alice.fill("#pass", "short");
  await alice.fill("#confirm", "short");
  await alice.click("main form:not([action]) button[type=submit]");
  log((await alice.locator(".msg.err").innerText()).includes("too short"), "zu kurze Passphrase wird abgelehnt");
  await alice.fill("#pass", PASS);
  await alice.fill("#confirm", PASS + "x");
  await alice.click("main form:not([action]) button[type=submit]");
  log((await alice.locator(".msg.err").innerText()).includes("do not match"), "abweichende Wiederholung wird abgelehnt");
  await alice.fill("#confirm", PASS);
  await alice.click("main form:not([action]) button[type=submit]");
  await alice.waitForSelector("input[readonly]");
  customerLink = await alice.locator("input[readonly]").inputValue();
  requestId = customerLink.match(/\/r\/([0-9a-f-]{36})#/)[1];
  log(/\/en\/r\/[0-9a-f-]{36}#.{22}$/.test(customerLink), "Kunden-Link mit Fingerabdruck im Fragment erzeugt");
  await flush(alice);
}

// ---------- F: Kunde antwortet ----------
{
  const c = await newPage("customer");
  await c.goto(customerLink.replace(/#.*/, "")); // Fragment fehlt
  await c.waitForSelector(".msg.err");
  log((await c.locator(".msg.err").innerText()).includes("incomplete"), "Kunden-Link ohne Fragment: abgelehnt");

  await c.goto("about:blank");
  await c.goto(customerLink.replace(/#.*/, "#" + "A".repeat(22))); // falscher Fingerabdruck = ausgetauschter Schlüssel
  await c.waitForSelector(".msg.err");
  log((await c.locator(".msg.err").innerText()).includes("does not match") && (await c.locator("textarea").count()) === 0, "falscher Fingerabdruck: Warnung, kein Eingabefeld");

  await c.goto("about:blank");
  await c.goto(customerLink);
  await c.waitForSelector("h1");
  log((await c.locator("h1").innerText()).includes("Alice is asking you") && (await c.locator("blockquote").innerText()) === "AWS root key", "Kunde sieht Absender und Frage");
  await c.fill("#answer", "s3cret-value 🔑 AKIA123");
  await c.click("main form:not([action]) button[type=submit]");
  await c.waitForSelector(".reveal.done");
  log((await c.locator(".reveal.done h1").innerText()).startsWith("Reply sent"), "Kunde sendet verschlüsselte Antwort");
  await flush(c);

  await c.goto("about:blank");
  await c.goto(customerLink);
  await c.waitForSelector(".msg.err");
  log((await c.locator(".msg.err").innerText()).includes("already answered"), "zweite Antwort nicht möglich, Link ist tot");
  await c.context().close();
}

// ---------- G: Ersteller öffnet ----------
{
  await alice.goto(`${base}/en/requests`);
  const row = alice.locator("tr", { hasText: "AWS root key" });
  log((await row.innerText()).includes("Answered"), "Übersicht zeigt die Anfrage als 'Answered'");
  await alice.goto(`${base}/en/requests/${requestId}`);
  await alice.fill("#pass", "falsche passphrase!!");
  await alice.click("main form:not([action]) button[type=submit]");
  await alice.waitForSelector(".msg.err");
  log((await alice.locator(".msg.err").innerText()).includes("has not been deleted"), "falsche Passphrase: Fehler, Antwort bleibt erhalten");
  await alice.fill("#pass", PASS);
  await alice.click("main form:not([action]) button[type=submit]");
  await alice.waitForSelector("#answer");
  log((await alice.locator("#answer").inputValue()) === "s3cret-value 🔑 AKIA123", "richtige Passphrase: Antwort entschlüsselt");
  await flush(alice);
  await alice.reload();
  log((await alice.locator("main").innerText()).includes("opened and deleted") && (await alice.locator("#pass").count()) === 0, "danach: Status 'Opened', kein zweites Öffnen");
}

// ---------- H: Benachrichtigung per Mail ----------
{
  // Eigene, unberührte Anfrage: die Mail kommt, solange niemand die Antwort geöffnet hat.
  const k = await createRequestKeys("mail check passphrase");
  const created = await alice.request.post(`${base}/api/v1/requests`, { data: { question: "Mail check", publicKey: k.publicKey, wrappedPrivateKey: k.wrappedPrivateKey, expiresInDays: 7 } });
  const mailId = (await created.json()).id;
  const ans = await fetch(`${base}/api/v1/requests/${mailId}/answer`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ciphertext: await encryptToPublicKey("mail-check-secret-XYZ", k.publicKey) }) });
  log(ans.status === 204, "Antwort auf 'Mail check' (API) angenommen");

  // Nur Mails zu dieser Anfrage zählen: Ob eine andere Anfrage zufällig im Abfragefenster lag, ist für diesen Test egal.
  const mailsFor = async () => {
    const all = (await (await fetch("http://localhost:8025/api/v1/search?query=to:alice@exostruction.com")).json()).messages ?? [];
    const out = [];
    for (const m of all) {
      const full = await (await fetch(`http://localhost:8025/api/v1/message/${m.ID}`)).json();
      if (full.Text.includes(`/requests/${mailId}`)) out.push(full);
    }
    return out;
  };
  let msgs = [];
  for (let i = 0; i < 25 && msgs.length === 0; i++) {
    msgs = await mailsFor();
    if (msgs.length === 0) await new Promise((r) => setTimeout(r, 2000));
  }
  const full = msgs[0];
  log(msgs.length === 1, `genau eine Mail für die Anfrage 'Mail check' (${msgs.length})`);
  log(!!full && full.Subject === "ExoSeal: a reply to your request has arrived", `Betreff in Alices Sprache (en): ${full?.Subject ?? "keine"}`);
  if (full) {
    log(full.Text.includes(`${base}/en/requests/${mailId}`), "Mail enthält den Dashboard-Link");
    log(!/mail-check-secret|XYZ|Mail check/.test(full.Text + full.Subject), "Mail enthält weder Antwort noch Frage");
  }
  await new Promise((r) => setTimeout(r, 12000)); // ein weiterer Poll-Durchlauf: es darf keine zweite Mail kommen
  log((await mailsFor()).length === 1, "keine Doppel-Mail beim nächsten Durchlauf");
}

// ---------- I: Filter + Pagination in der Datenbank ----------
{
  // 22 Zeilen direkt per SQL (das Rate-Limit erlaubt 20 neue Anfragen pro Minute)
  execSync("docker compose -f ../docker-compose.yml -f ../docker-compose.build.yml -f ../docker-compose.dev-idp.yml exec -T postgres psql -U exoseal -d exoseal", {
    input: `INSERT INTO secret_requests ("Id","OwnerSub","Locale","Question","PublicKey","WrappedPrivateKey","CreatedAt","ExpiresAt","NotifyAttempts")
            SELECT gen_random_uuid(), 'alice-sub', 'en', 'Bulk ' || lpad(i::text, 2, '0'), decode(repeat('04', 65), 'hex'), decode(repeat('00', 190), 'hex'),
                   now() - (i || ' minutes')::interval, now() + interval '7 days', 0 FROM generate_series(1, 22) i;`,
    stdio: ["pipe", "pipe", "pipe"],
  });
  await alice.goto(`${base}/en/requests?sort=created_asc`);
  const text1 = await alice.locator("main").innerText();
  const rows1 = await alice.locator("tbody tr").count();
  log(rows1 === 20 && text1.includes("Page 1 of 2") && text1.includes("24 requests"), `Seite 1: 20 Zeilen, 'Page 1 of 2', 24 Anfragen (${rows1})`);
  await alice.getByRole("link", { name: "Next" }).click();
  await alice.waitForURL(/page=2/);
  log((await alice.locator("tbody tr").count()) === 4, "Seite 2: Rest (4 Zeilen)");
  await alice.goto(`${base}/en/requests?status=open`);
  log((await alice.locator("main").innerText()).includes("22 requests"), "Filter 'Open': 22");
  await alice.goto(`${base}/en/requests?status=answered`);
  log((await alice.locator("tbody tr").count()) === 1 && (await alice.locator("main").innerText()).includes("Mail check"), "Filter 'Answered': genau 'Mail check' (ungeöffnet)");
  await alice.goto(`${base}/en/requests?status=consumed`);
  log((await alice.locator("tbody tr").count()) === 1 && (await alice.locator("main").innerText()).includes("AWS root key"), "Filter 'Opened': genau die geöffnete Anfrage");
  await alice.goto(`${base}/en/requests?status=quatsch&page=abc&sort=hax`);
  log((await alice.locator("tbody tr").count()) > 0, "ungültige Parameter werden auf Standardwerte abgefangen");
  await flush(alice);
}

// ---------- J: Eigentum + Löschen ----------
{
  const bob = await newPage("bob");
  await login(bob, "bob-sub", { email: "bob@exostruction.com", email_verified: true, name: "Bob" });
  await bob.goto(`${base}/en/requests`);
  log((await bob.locator("main").innerText()).includes("0 requests"), "Bob sieht keine Anfragen von Alice");
  const r = await bob.goto(`${base}/en/requests/${requestId}`);
  log(r.status() === 404, "Bob bekommt für Alices Anfrage 404");
  await bob.context().close();

  await alice.goto(`${base}/en/requests?status=open`);
  await alice.getByRole("link", { name: "Bulk 01" }).click();
  await alice.getByRole("button", { name: "Delete request" }).click();
  await alice.getByRole("button", { name: "Yes, delete" }).click();
  await alice.waitForURL(/\/en\/requests$/);
  log(!(await alice.locator("main").innerText()).includes("Bulk 01"), "Löschen entfernt die Anfrage");
}

// ---------- K: Logout ----------
{
  await alice.goto(`${base}/en`);
  await alice.getByRole("button", { name: "Sign out" }).click();
  await alice.waitForSelector("a[href$='/login']");
  log(true, "Logout: wieder ausgeloggt");
  const r = await alice.request.get(`${base}/api/v1/me`);
  log(r.status() === 401, "/me nach Logout: 401");
  await flush(alice);
}

log(violations.length === 0, `keine CSP-Verstöße über alle Seiten (${violations.length})${violations.length ? ": " + violations.slice(0, 5).join(" | ") : ""}`);
await browser.close();
console.log(failed === 0 ? "\nALLES OK" : `\n${failed} FEHLER`);
process.exitCode = failed ? 1 : 0;
