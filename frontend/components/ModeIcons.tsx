// Eigene Icons im Stil des Logos: kräftige, gefüllte Formen in Rosa, dazu das Sternchen aus dem Passwortfeld.
// Die Aussparungen nehmen die Farbe der Fläche dahinter (--surface), so passen sie sich Hell und Dunkel an.

const STAR = (cx: number, cy: number, o: number) => (
  <g key={cx} opacity={o} stroke="currentColor" strokeWidth="3" strokeLinecap="round">
    <line x1={cx} y1={cy - 4.5} x2={cx} y2={cy + 4.5} />
    <line x1={cx - 3.9} y1={cy - 2.25} x2={cx + 3.9} y2={cy + 2.25} />
    <line x1={cx + 3.9} y1={cy - 2.25} x2={cx - 3.9} y2={cy + 2.25} />
  </g>
);

/** Senden: gefüllter Umschlag mit Siegelpunkt. */
export function SendIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <rect x="3" y="9" width="42" height="30" rx="7" fill="currentColor" />
      <path d="M7 15.5 24 28 41 15.5" stroke="var(--surface)" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Anfragen: Passwortfeld mit Sternchen, die zum Ende hin verblassen (wie im Logo). */
export function RequestIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <rect x="3" y="12" width="42" height="24" rx="7" stroke="currentColor" strokeWidth="3.5" />
      {[12, 22, 32, 42].map((x, i) => (i < 3 ? STAR(x - 1 + 0, 24, [1, 0.65, 0.3][i]) : null))}
    </svg>
  );
}
