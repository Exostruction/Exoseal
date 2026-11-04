# What ExoSeal protects, and what it does not

Short and honest. The [README](../README.md) links here. The public, translated version lives on the website at `/security` (texts in `frontend/messages/<language>/pages.json`); keep both in sync when this file changes.

## What the server sees

| | Stored on the server | Never reaches the server |
|---|---|---|
| **Send a secret** | AES-GCM ciphertext, expiry, random ID, **the sender's provider ID and an optional plain-text label** (so the sender sees a "Sent" list and can withdraw a link) | the key (it lives in the `#` part of the link) and the plaintext |
| **Request** (question + reply) | question (plain text, the customer must read it), owner name and email, public key, private key **encrypted with the owner's passphrase**, the customer's reply encrypted to the public key | the passphrase, the unlocked private key, the reply in plain text |
| **Link outcome** | for 30 days after a secret is gone: its random ID, the reason (opened, expired, reported, withdrawn), times, the sender's provider ID and label, so a link can say what happened and the sender keeps the entry | content, recipient, IP |
| **Notifications** | owner email (only to send the mail) | content: mails and webhooks say "a reply arrived" plus a link, nothing else |
| **Logs** | warnings only, no IPs, IDs, paths or contents (verified, see `OPERATIONS.md`) | |

A CDN or protection service in front of the instance (for example Cloudflare) terminates TLS and therefore delivers the JavaScript instead of the origin server. It is one more party that could serve modified code, which is the same trust limit as a malicious server (see below). It also sees IP addresses. The privacy page names such services (`PRIVACY_SERVICES`).

## Protected against

- **A database leak or backup leak.** Ciphertext only. Secrets are single-use and short-lived.
- **A curious operator reading the database or logs.** Same reason.
- **Link preview bots** (Slack, Teams, Outlook): they `GET`; revealing needs a `POST` behind a button.
- **Typos costing the secret.** The passphrase is checked in the browser before the reply is fetched and deleted; a wrong password on a protected secret keeps it in memory of the open page.
- **Swapped public keys in the database** (request flow): the customer link carries a fingerprint of the public key in its `#` part. The customer's browser compares it with the key it receives and refuses to continue on a mismatch.
- **Parallel claims.** Opening and answering are single SQL statements; 30 to 40 concurrent attempts in the tests produce exactly one winner.
- **Cross-site scripting escalation.** Strict CSP with per-request nonces, no external sources.
- **Foreign pages acting for a signed-in user,** including pages on sibling subdomains. `SameSite=Lax` does not separate those, so the backend accepts POST and DELETE only from its own origin (`Sec-Fetch-Site`, `Origin` as fallback).
- **One visitor using up everyone's limit and a hijacked account filling the database.** Rate limits count signed-in users by user ID and everyone else by IP (with the real IP from the proxy); quotas cap running links (500) and requests (200) per user.

## Not protected against

- **A malicious or compromised server that serves modified JavaScript.** Like every web-based end-to-end encryption, the code that encrypts is delivered by the server. Mitigations: it is open source and self-hostable, the CSP is strict, and you can host it yourself. For very high stakes use a native tool (age, GPG).
- **Offline guessing of a weak passphrase** if the database leaks: the wrapped private key is stored on the server. PBKDF2-SHA256 with 600,000 iterations slows this down, but a short passphrase will fall. Use a long sentence. The UI enforces only a minimum of 10 characters.
- **A stolen session cookie.** The session lasts a fixed 8 hours and the server cannot end it early (sign-out only deletes the cookie). HttpOnly and the strict CSP make theft hard; a server-side session store in Valkey would add revocation if ever needed.
- **Rate limits when Valkey is down.** They fail open, on purpose: no link should become unreachable because a counter store is.
- **The first reply to a request link wins,** so whoever holds the link can answer before the real customer. That follows from "the link is the permission".
- **A lost passphrase.** There is no recovery; the reply is gone.
- **A compromised browser or endpoint** on either side, shoulder surfing, clipboard managers.
- **Metadata.** The server knows that a request exists, when it was created, answered and opened, its question, and who owns it. The reverse proxy sees IPs and paths unless you configure it not to log them.
- **Someone who gets the full link** (including the `#` part) before the intended recipient: the first opener wins. That is what the "already opened" warning is for: if the legitimate recipient finds the link used up, something is wrong.
- **The customer link is shown only once**, right after creating the request. The server could rebuild it, but a link shown by the server cannot vouch for the server's own key.
- **The optional GitHub star count** (`GITHUB_REPO`) is fetched by the frontend server, not by the visitor's browser: GitHub learns the server's address, never anything about visitors. Set `GITHUB_REPO=off` to disable the outbound request.
