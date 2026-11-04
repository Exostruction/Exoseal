// Setzt das letzte Wort eines Titels als Akzent (Fraunces kursiv, rosa). Titel aus nur einem Wort bleiben schlicht.
export function Accent({ text }: { text: string }) {
  const m = /^([\s\S]*\s)?(\S+)$/.exec(text.trim());
  if (!m || !m[1]) return <>{text}</>; // ein einzelnes Wort bleibt schlicht
  return (
    <>
      {m[1] ?? ""}
      <em className="once">{m[2]}</em>
    </>
  );
}
