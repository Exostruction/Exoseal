import { AlertCircle, CheckCircle2, Info } from "lucide-react";

// Eine Meldung unter dem Formular: Fehler (role=alert), Erfolg oder Hinweis (role=status).
const ICON = { err: AlertCircle, ok: CheckCircle2, info: Info } as const;

export function Msg({ kind, children }: { kind: keyof typeof ICON; children: React.ReactNode }) {
  const Icon = ICON[kind];
  return (
    <div className={`msg ${kind}`} role={kind === "err" ? "alert" : "status"}>
      <Icon size={20} strokeWidth={1.75} aria-hidden="true" />
      <span>{children}</span>
    </div>
  );
}
