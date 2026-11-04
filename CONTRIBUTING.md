# Contributing

Thanks for helping. ExoSeal is small on purpose, so please open an issue before a large change.

Please read the [Code of Conduct](CODE_OF_CONDUCT.md). By taking part you agree to follow it.

## Ground rules

- **No plaintext, ever.** Nothing a user typed, no IP address, no recipient and no secret ID in a log or database column that is not already there on purpose. See [docs/THREAT-MODEL.md](docs/THREAT-MODEL.md).
- **Logic in the backend.** The frontend does the browser-side encryption and the display. Filtering, sorting and paging happen in the database.
- **Every visible text is translated.** German and English (`frontend/messages/{de,en}`, `IStringLocalizer` and the `.resx` files in the backend).
- **Dependencies:** only AGPL-compatible licenses (MIT, Apache-2.0, BSD, ISC, …); CI checks this. Prefer the standard library or a platform feature over a new package. Use LTS versions.
- **Security headers stay strict:** no inline scripts or styles, the CSP uses a per-request nonce.
- **Cache invalidation matters, and secrets are never cached.**

## Run the tests

```sh
# backend: needs a PostgreSQL for the one-time-read tests
docker run -d --name exoseal-test-db -p 55432:5432 -e POSTGRES_PASSWORD=test -e POSTGRES_DB=test postgres:18.6-alpine
TEST_POSTGRES="Host=localhost;Port=55432;Database=test;Username=postgres;Password=test" dotnet test backend

# frontend (Yarn via Corepack)
cd frontend && corepack enable && yarn install --immutable && yarn lint && yarn test && yarn build

# whole flow in a browser, against the dev stack from the README
cd e2e && npm ci && npm test
```

## Pull requests

- Keep them small and focused, with tests for new behavior.
- Explain *why* in the description. Commit messages in English or German are both fine.
- By contributing you agree that your work is licensed under the [AGPL-3.0](LICENSE) like the rest of the project.

Accepted pull requests are merged by the maintainers. Because this repository is published from an internal one, your commit may
appear as part of the next release instead of as a separate merge.
