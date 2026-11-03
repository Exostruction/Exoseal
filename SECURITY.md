# Security policy

ExoSeal exists to handle secrets, so we take reports seriously and answer quickly.

## Reporting a vulnerability

Please report privately and do not open a public issue.

- Use GitHub's **Report a vulnerability** button on the *Security* tab of this repository, or
- write to **hello@exostruction.com**.

Include what you found, how to reproduce it, and the version (`vX.Y.Z` is shown in the page footer). We will confirm receipt within
three working days, keep you informed, and credit you in the release notes if you like.

## What is in scope

Flaws that let someone read, change or destroy a secret or an answer without the link or passphrase, bypass the allowlist or login,
read data across users, bypass the one-time read, or weaken the encryption. Weak spots in rate limiting, headers or the CSP count too.

Not in scope: the properties listed under "Not protected against" in [docs/THREAT-MODEL.md](docs/THREAT-MODEL.md) (for example a
compromised recipient device or someone who obtains the link before the recipient), missing hardening of your own server or reverse
proxy, and automated scanner output without a working exploit.

## Supported versions

Only the latest release gets security fixes. Run a pinned version and update when a release is announced.
