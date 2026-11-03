import { Accent } from "@/components/Accent";

// Gemeinsame Darstellung für 404 und 500: große Zahl, Titel, Text, Knöpfe, Schnelllinks.
// Ohne Server-Abhängigkeiten, damit auch error.tsx (Client) sie nutzen kann.
export function ErrorView({ code, title, text, children }: { code: string; title: string; text: string; children?: React.ReactNode }) {
  return (
    <main id="main" className="error bare spots">
      <div className="error-in">
        <span className="code" aria-hidden="true">{code}</span>
        <h1><Accent text={title} /></h1>
        <p>{text}</p>
        {children}
      </div>
    </main>
  );
}
