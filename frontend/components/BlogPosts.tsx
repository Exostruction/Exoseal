import { ArrowRight } from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";
import { Accent } from "@/components/Accent";
import { BlogCard } from "@/components/BlogCard";
import { Link } from "@/i18n/navigation";
import { getBlogPosts } from "@/lib/blog";

// "Aus dem Blog": die neuesten Beiträge der Herausgeber-Seite zu ExoSeal. Ohne passende Beiträge erscheint nichts.
export async function BlogPosts({ locale }: { locale: string }) {
  const posts = await getBlogPosts();
  if (posts.length === 0) return null;
  const [t, format] = await Promise.all([getTranslations("landing.blog"), getFormatter()]);
  return (
    <section className="sec" id="blog">
      <div className="sec-in">
        <div className="cs-head">
          <span className="eyebrow">{t("eyebrow")}</span>
          <h2><Accent text={t("title")} /></h2>
          <p>{t("intro")}{locale !== "de" && <> {t("german")}</>}</p>
        </div>
        <ul className="bp">
          {posts.map((p) => (
            <BlogCard key={p.url} post={{ ...p, dateLabel: p.date ? format.dateTime(new Date(p.date), { dateStyle: "medium" }) : "" }} read={t("read")} sizes="(min-width: 64rem) 30vw, 100vw" />
          ))}
        </ul>
        <p className="pf-links"><Link href="/blog">{t("all")} <ArrowRight size={16} aria-hidden="true" /></Link></p>
      </div>
    </section>
  );
}
