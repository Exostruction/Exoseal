// Öffentliche Adresse dieser Instanz (zur Laufzeit gelesen) und der Herausgeber, der überall verlinkt wird.
export const siteUrl = () => (process.env.PUBLIC_URL ?? "http://localhost:3000").replace(/\/$/, "");

export const MAKER = { name: "Exostruction", url: "https://exostruction.com" } as const;

// Standard: das Projekt-Repo. "besitzer/repo" überschreibt es (Fork), "off" schaltet Link und Sternabfrage ab.
const REPO = "Exostruction/Exoseal";
export const githubRepo = () => {
  const r = process.env.GITHUB_REPO || REPO;
  return /^[\w.-]+\/[\w.-]+$/.test(r) ? r : undefined;
};
