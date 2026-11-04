import de from "../messages/de/guides.json";

// Die Liste der Anleitungen ergibt sich aus den Texten: Wer unter "items" einen neuen Eintrag anlegt (in allen Sprachen),
// bekommt automatisch Seite, Eintrag in der Übersicht, Sitemap und llms.txt.
export type Guides = typeof de;
export type GuideSlug = keyof Guides["items"];
export const GUIDE_SLUGS = Object.keys(de.items) as GuideSlug[];
export const isGuide = (s: string): s is GuideSlug => (GUIDE_SLUGS as string[]).includes(s);
