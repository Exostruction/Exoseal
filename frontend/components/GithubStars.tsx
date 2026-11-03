import { Star } from "lucide-react";
import { githubRepo } from "@/lib/site";

// Die Sternzahl holt der Server (nicht der Browser) und merkt sie sich eine Stunde: Besucher lösen nie eine Anfrage an GitHub aus.
async function stars(repo: string): Promise<number | null> {
  try {
    const res = await fetch(`https://api.github.com/repos/${repo}`, { next: { revalidate: 3600 }, headers: { accept: "application/vnd.github+json" } });
    if (!res.ok) return null;
    const n = ((await res.json()) as { stargazers_count?: unknown }).stargazers_count;
    return typeof n === "number" ? n : null;
  } catch {
    return null;
  }
}

export async function GithubStars({ label }: { label: string }) {
  const repo = githubRepo();
  if (!repo) return null;
  const n = await stars(repo);
  return (
    <a className="gh" href={`https://github.com/${repo}`} rel="noopener">
      <Star size={16} strokeWidth={1.75} aria-hidden="true" />
      {label}{n !== null && <b>{new Intl.NumberFormat("en", { notation: "compact" }).format(n)}</b>}
    </a>
  );
}
