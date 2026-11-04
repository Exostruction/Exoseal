// Läuft einmal beim Start des Servers. Fehler (kein Netz, Suchmaschine nicht erreichbar) dürfen den Start nie stören.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { submitIndexNow } = await import("./lib/indexnow");
  submitIndexNow().catch((e) => console.warn("IndexNow nicht gemeldet:", e instanceof Error ? e.message : e));
}
