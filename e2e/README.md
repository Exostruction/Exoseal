# End-to-End-Test

Läuft im echten Browser gegen den Dev-Stack mit Mock-Login und Mailpit. Wird nicht in der CI ausgeführt (braucht Browser und Stack).

```sh
# 1. Stack mit Mock-Anbieter starten (leere Datenbank, der Test zählt Zeilen)
docker compose -f docker-compose.yml -f docker-compose.build.yml -f docker-compose.dev-idp.yml down -v
docker compose -f docker-compose.yml -f docker-compose.build.yml -f docker-compose.dev-idp.yml up -d --build

# 2. Test (installiert einmal playwright-core; nutzt einen installierten Chrome, sonst E2E_BROWSER_CHANNEL=msedge setzen)
cd e2e && npm install && npm test
```

Der Browser startet mit `--host-resolver-rules=MAP mockidp.localhost 127.0.0.1`, deshalb ist kein hosts-Eintrag nötig.
Node 24+ ist nötig, weil der Test `frontend/lib/pkcrypto.ts` direkt importiert.
