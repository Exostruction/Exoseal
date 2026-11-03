import { getTranslations } from "next-intl/server";
import { FooterLangs } from "@/components/FooterLangs";
import { GithubStars } from "@/components/GithubStars";
import { HeaderCta, HeaderNav, MobileMenu } from "@/components/HeaderLinks";
import { Logo, LogoStacked } from "@/components/Logo";
import { LangSwitch } from "@/components/LangSwitch";
import { ScrollState } from "@/components/ScrollState";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Link } from "@/i18n/navigation";
import pkg from "../package.json";
import { getMe } from "@/lib/backend";
import { getBlogPosts } from "@/lib/blog";
import { MAKER } from "@/lib/site";

export async function SiteHeader() {
  const [t, me, posts] = await Promise.all([getTranslations("common"), getMe(), getBlogPosts(1)]);
  const signedIn = !!me;
  const blog = posts.length > 0;
  return (
    <header className="bar">
      <ScrollState />
      <div className="bar-in">
        <Link href="/" className="brand"><Logo height={40} title={t("appName")} /></Link>
        <HeaderNav blog={blog} />
        <div className="bar-end">
          <ThemeToggle />
          <LangSwitch />
          <HeaderCta signedIn={signedIn} />
          <MobileMenu signedIn={signedIn} blog={blog} />
        </div>
      </div>
    </header>
  );
}

export async function SiteFooter() {
  const [t, l, posts] = await Promise.all([getTranslations("common.foot"), getTranslations("legal"), getBlogPosts(1)]);
  return (
    <footer className="foot">
      <div className="foot-top">
        <div className="foot-brand">
          <Link href="/" className="brand"><LogoStacked height={112} title={(await getTranslations("common"))("appName")} /></Link>
          <p>{t.rich("tagline", { once: (c) => <em className="once">{c}</em> })}</p>
        </div>
        <nav aria-label={t("product")}>
          <h2>{t("product")}</h2>
          <ul>
            <li><Link href="/#how">{t("how")}</Link></li>
            <li><Link href="/guides">{t("guides")}</Link></li>
            <li><Link href="/faq">{t("faq")}</Link></li>
            <li><Link href="/security">{t("pSecurity")}</Link></li>
            <li><Link href="/compare">{t("compare")}</Link></li>
          </ul>
        </nav>
        <nav aria-label={t("project")}>
          <h2>{t("project")}</h2>
          <ul>
            <li><Link href="/open-source">{t("openSource")}</Link></li>
            <li><Link href="/guides/self-hosting">{t("selfHost")}</Link></li>
            <li><Link href="/changelog">{t("changelog")}</Link></li>
            {posts.length > 0 && <li><Link href="/blog">{t("blog")}</Link></li>}
            <li><GithubStars label={(await getTranslations("landing"))("gh")} /></li>
          </ul>
        </nav>
        <nav aria-label={t("company")}>
          <h2>{t("company")}</h2>
          <ul>
            <li><a href={MAKER.url} rel="noopener">{t("makerLink")}</a></li>
          </ul>
        </nav>
        <nav aria-label={t("legalHead")}>
          <h2>{t("legalHead")}</h2>
          <ul>
            <li><Link href="/imprint">{l("imprintLink")}</Link></li>
            <li><Link href="/privacy">{l("privacyLink")}</Link></li>
            <li><Link href="/terms">{l("termsLink")}</Link></li>
          </ul>
        </nav>
      </div>
      <div className="foot-bottom">
        <span>{t.rich("bottom", { maker: (c) => <a href={MAKER.url} rel="noopener">{c}</a> })}</span>
        <Link href="/changelog" className="ver" title={t("changelog")}>v{pkg.version}</Link>
        <FooterLangs />
      </div>
    </footer>
  );
}
