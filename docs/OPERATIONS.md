# Operating ExoSeal

Notes for anyone self-hosting ExoSeal. See the [README](../README.md) for the quick start.

## Reverse proxy and client IP

ExoSeal needs a reverse proxy in front of the frontend for TLS anyway. The proxy is also the only component that knows the
real client IP: the Next.js frontend passes `X-Forwarded-For` through unchanged and adds nothing.

Only visitors who are not signed in are counted by IP. Signed-in users are counted by their user ID, because their calls to the
lists come from the frontend server, which would otherwise make every user share one counter. Both are hashed before they reach Valkey.

The IP is used only for rate limiting. It is hashed with a per-process random key before it reaches Valkey, and it is never
stored or logged.

| `TRUSTED_PROXY_HOPS` | Meaning |
|---|---|
| `0` (default) | Header is ignored. Cannot be spoofed, but all visitors share one rate-limit counter. Fine for development. |
| `1` | Exactly one reverse proxy sits in front of the frontend and appends the client IP. **Use this in production.** |
| `2` | Two stations: Cloudflare, then a proxy such as Traefik, then the frontend. This is our setup: Cloudflare puts the visitor in `X-Forwarded-For`, Traefik appends Cloudflare's address, so the visitor is the second entry from the right. **Traefik must trust only Cloudflare's address ranges** (`entrypoints.*.forwardedheaders.trustedips`), otherwise it keeps a forged header from a direct call. With that setting, direct calls to the server cannot fake an address. |

To check it after deploying: open the same secret link from two different networks (for example laptop and phone) about 31 times within a minute. The second network must not be blocked when the first one is.

Setting it higher than the real number of proxies lets attackers dodge the limit with a forged header.

If the real IP arrives in a header of its own (Cloudflare: `CF-Connecting-IP`), set `CLIENT_IP_HEADER` to its name instead of `TRUSTED_PROXY_HOPS`. Do this only if the
server cannot be reached except through that proxy, otherwise anyone can forge the header. Setting both makes the backend refuse to start. If neither is set in
production, the backend logs a warning at start: all visitors then share the limits of the public pages, so a single bot could block opening links for everyone.

Writing calls (POST, DELETE) are accepted only from the site's own origin: the backend checks `Sec-Fetch-Site` and falls back to `Origin` for very old browsers. It
compares with `PUBLIC_URL`, so that must be the address people really use. This also stops pages on sibling subdomains of your domain, which `SameSite=Lax` does not.

Quotas per user: 500 running links and 200 running requests. The limit counts what has not expired or been collected yet; the user sees a message and can withdraw old links.

Minimal Caddy example (Caddy replaces untrusted incoming `X-Forwarded-For`, so `1` is correct):

```
seal.example.com {
    reverse_proxy frontend:3000
}
```

For nginx use `proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;` and `TRUSTED_PROXY_HOPS=1`.

Set `PUBLIC_URL=https://seal.example.com` so the OIDC redirect URI is right and the CSP adds `upgrade-insecure-requests`.
Register `<PUBLIC_URL>/api/v1/auth/callback` at your identity provider.

## Backups

The database holds only ciphertext, but treat dumps as sensitive anyway (they also contain the cookie signing keys).

**Do not back up the `secrets` table.** Secrets are ephemeral by design. Restoring a backup brings back secrets that were
already opened or reported, which breaks the one-time guarantee. Back up everything else:

```sh
pg_dump --exclude-table-data=secrets -Fc -U exoseal exoseal > exoseal.dump
```

If you restored a full dump by mistake, run `TRUNCATE secrets;` before bringing the service back up.

If the `DataProtectionKeys` table is lost, nothing breaks except that everyone has to sign in again.

## Logs

The default log level is `Warning`. Verified with marker traffic and a forced server error: no secret IDs, keys, IPs, user
agents, request paths or contents appear in the logs of any container. Keep it that way:

- do not raise `Logging__LogLevel__Microsoft.AspNetCore` to `Information` (request logs contain paths, and the path holds the secret ID),
- do not enable EF Core sensitive data logging,
- do not enable access logs on the frontend; if your reverse proxy logs requests, anonymise or disable them for `/*/s/*` and `/api/v1/secrets/*`.

## Abuse reports

Every secret link has a "Report this link" page that deletes the secret without reading it. The deleted link then answers "reported" (or "opened" / "expired") to whoever visits it again, from a note kept for 30 days (random ID, reason, times, sender's provider ID and label; table `secret_tombstones`, cleaned up by the background job). The same notes feed the sender's "Sent" list. Set `ABUSE_EMAIL` to show a
contact address on that page.

## Cloudflare and CrowdSec in front of the instance

The application itself never stores or logs IP addresses. A service in front of it does see them, so name it in the privacy policy with `PRIVACY_SERVICES` (comma-separated): `cloudflare`, `crowdsec`, or `crowdsecshare` (CrowdSec that shares detected attacks with its community). The privacy page then shows a "Service providers" section.

Checklist for Cloudflare: sign the data processing agreement; switch off Web Analytics and Browser Insights (they add scripts and cookies, and the CSP would block them); keep Bot Fight Mode off or allow verified bots so Googlebot can crawl; do not cache HTML (every page carries a per-request CSP nonce). For the client IP set `TRUSTED_PROXY_HOPS` to the number of proxies in front of the backend (Cloudflare counts as one hop, and the reverse proxy must trust Cloudflare's address ranges and pass the real client address), otherwise all visitors share one rate limit.

Checklist for CrowdSec: decide on sharing before you enable it, and only list `crowdsecshare` if signals are shared. If the instance is enrolled in the CrowdSec console, signals are shared: use `crowdsecshare` (our instance does). Sign the data processing agreement with each provider before you list it.

## Blog posts on the home page

With `BLOG_ENABLED=true` the home page shows the newest posts of the maker's blog (`https://exostruction.com/feed.xml`) in the category `BLOG_CATEGORY` (default `ExoSeal`), with their cover images. The frontend server fetches the feed once an hour and serves the cover images itself, so visitors never contact the other site. Only links and images from the maker's own site are accepted. Without matching posts, or on any error, the block is simply not shown. Leave it off on your own instance unless you want to show those posts.

## Legal pages

The imprint is built from `IMPRINT_NAME`, `IMPRINT_ADDRESS` (use `\n` for line breaks), `IMPRINT_EMAIL`, `IMPRINT_REPRESENTED_BY`, `IMPRINT_PHONE`, `IMPRINT_REGISTER` and `IMPRINT_VAT_ID`; empty fields are left out. The terms of use (`/terms`) insert `IMPRINT_NAME` as the operator. The terms and the privacy text are drafts: have them reviewed before you run a public instance.

## Caching

All pages are rendered per request (`Cache-Control: no-store`). This is deliberate: the strict Content-Security-Policy uses a fresh nonce per request, so a page cannot be served from a shared cache without weakening it. A CDN in front still serves the static assets under `/_next/static/` (cache them long). If page speed ever needs more, the route is hash-based CSP, not caching dynamic HTML.

## Notifications (request links)

When a customer answers a request, the owner is notified. Both channels are optional and never contain content: only
"a reply arrived" plus a link to the dashboard.

| Variable | Meaning |
|---|---|
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` | Mail. Empty `SMTP_HOST` = off. TLS (STARTTLS or implicit) is chosen automatically. `SMTP_FROM` is required when the host is set. |
| `WEBHOOK_URL`, `WEBHOOK_SECRET` | Webhook. Empty URL = off. The secret must be at least 16 characters. |
| `PUBLIC_URL` | Used for the dashboard link in mails and webhooks. |

The mail is written in the language the owner used when creating the request (`de` or `en`).

A wrong configuration stops the backend at startup instead of silently sending nothing.

Delivery is a small queue in the database, worked off every 10 seconds. It survives restarts, retries failures with backoff
(30 s, 2 min, 10 min, 1 h, 1 h; then it gives up), and tracks mail and webhook separately so a retry never sends a second mail.
No notification is sent for a request whose reply was already opened.

**Webhook format.** `POST` with a JSON body

```json
{"event":"request.answered","requestId":"...","answeredAt":"...","dashboardUrl":"https://seal.example.com/en/requests/..."}
```

and the headers `X-ExoSeal-Timestamp` (Unix seconds) and `X-ExoSeal-Signature: v1=<hex>`. The signature is
`HMAC-SHA256(secret, "<timestamp>.<body>")`. Verify it with a constant-time comparison and reject old timestamps (for example
older than 5 minutes) to prevent replays. Redirects are not followed.

## Public pages, SEO and discoverability

These need no setup beyond `PUBLIC_URL` (it becomes the canonical address, the base of `sitemap.xml` and the links in `llms.txt`).

| Address | What it is |
|---|---|
| `/sitemap.xml` | Built from `frontend/lib/pages.ts`. New pages and guides appear on their own. `/sitemap.txt` and similar spellings redirect here. |
| `/robots.txt` | Public pages are open (also for AI crawlers). Secret links, requests and the app are blocked. The sign-in page stays crawlable on purpose: it is linked everywhere and carries `noindex`, which search engines can only read if they may fetch the page. |
| `/favicon.ico`, `/apple-icon.png`, `/icon.svg` | Icons from the logo set; served without a language prefix (crawlers ask for `/favicon.ico` directly). |
| `/llms.txt` | Short English description for AI assistants, with the page list. |
| `/en/guides`, `/en/faq` | Guides and FAQ (every page also exists in German under `/de`). |

Guides are created from `frontend/messages/<language>/guides.json` (`items`): add an entry in every language and the page, the overview, the sitemap and `llms.txt` follow.

Unknown addresses, including ones with a dot such as `/sitemap.xx`, get the custom 404 page (status 404).

Optional: `GITHUB_REPO=owner/repo` shows a GitHub link with the star count on the home page and in the footer. The frontend server asks the GitHub API
(cached for one hour); the visitor's browser never contacts GitHub.

The footer links to the maker of ExoSeal (see `frontend/lib/site.ts`) and the search-engine data names the maker as publisher.

Public feed: `/feed.xml` (Atom) and `/changelog.json` list the changelog entries and guides, newest first (`?lang=de` for German). Another site can poll them once a day. Entries come from `frontend/messages/<language>/pages.json` (`changelog.items`) and the guides, so there is nothing else to maintain.

The social preview image (`/<language>/opengraph-image`) is generated by the frontend and uses the ExoSeal logo. The accent font is bundled at build time (`next/font`) and served from your own origin: visitors never contact a font provider, and no cookies are set.

## Local development without an identity provider

```sh
docker compose -f docker-compose.yml -f docker-compose.build.yml -f docker-compose.dev-idp.yml up -d --build
```

This adds a mock OIDC server (any username and claims) and Mailpit (http://localhost:8025). Details are at the top of
`docker-compose.dev-idp.yml`. `Auth__AllowInsecureMetadata` lets the backend talk to it over plain http; never set it in production.
The browser test in `e2e/` runs against this stack.

