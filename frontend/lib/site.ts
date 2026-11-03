// Öffentliche Adresse dieser Instanz (zur Laufzeit gelesen) und der Herausgeber, der überall verlinkt wird.
export const siteUrl = () => (process.env.PUBLIC_URL ?? "http://localhost:3000").replace(/\/$/, "");

export const MAKER = { name: "Exostruction", url: "https://exostruction.com" } as const;

// Optional: "besitzer/repo". Ohne Angabe gibt es keinen GitHub-Link.
export const githubRepo = () => (/^[\w.-]+\/[\w.-]+$/.test(process.env.GITHUB_REPO ?? "") ? (process.env.GITHUB_REPO as string) : undefined);
