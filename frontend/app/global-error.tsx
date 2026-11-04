"use client";

import "./globals.css";
import { ErrorView } from "@/components/ErrorView";

// Letzter Rettungsanker, falls schon das Grundgerüst der Seite fehlschlägt. Hier gibt es keine Übersetzungen, deshalb zweisprachig.
export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="en">
      <body>
        <ErrorView code="500" title="Something went wrong / Etwas ist schiefgelaufen" text="Your data was not shown or saved. / Deine Daten wurden nicht angezeigt oder gespeichert.">
          <div className="actions">
            <button type="button" className="primary" onClick={reset}>Retry / Erneut versuchen</button>
          </div>
        </ErrorView>
      </body>
    </html>
  );
}
