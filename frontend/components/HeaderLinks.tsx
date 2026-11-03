"use client";

import { ArrowUpRight, BookOpen, ChevronDown, CircleHelp, GitBranch, Menu, Newspaper, Scale, ScrollText, ShieldCheck, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useDismiss } from "@/components/useDismiss";
import { Link } from "@/i18n/navigation";

const ITEMS = [["how", ShieldCheck, "/#how"], ["guides", BookOpen, "/guides"], ["faq", CircleHelp, "/faq"], ["compare", Scale, "/compare"], ["changelog", ScrollText, "/changelog"]] as const;
const MORE = [["openSource", GitBranch, "/open-source"]] as const;

const BLOG = ["blog", Newspaper, "/blog"] as const;

export function HeaderNav({ blog = false }: { blog?: boolean }) {
  const t = useTranslations("common.nav");
  const [open, setOpen] = useState(false);
  const ref = useDismiss(open, () => setOpen(false));
  return (
    <nav className="nav" aria-label={t("label")} ref={ref}>
      <button type="button" className="nav-btn" aria-expanded={open} aria-controls="nav-mega" onClick={() => setOpen((v) => !v)}>
        {t("product")}<ChevronDown size={16} aria-hidden="true" />
      </button>
      <Link href="/security">{t("security")}</Link>
      <Link href="/open-source">{t("openSource")}</Link>
      {open && (
        <div className="mega" id="nav-mega">
          {(blog ? [...ITEMS, BLOG] : ITEMS).map(([k, Icon, href]) => (
            <Link key={k} href={href} onClick={() => setOpen(false)}>
              <Icon size={22} strokeWidth={1.6} aria-hidden="true" />
              <span><strong>{t(`menu.${k}.title`)}</strong><small>{t(`menu.${k}.text`)}</small></span>
            </Link>
          ))}
        </div>
      )}
    </nav>
  );
}

export function HeaderCta({ signedIn }: { signedIn: boolean }) {
  const t = useTranslations("common");
  return <Link href={signedIn ? "/new" : "/login"} className="nav-cta">{signedIn ? t("toApp") : t("login")}<ArrowUpRight size={15} strokeWidth={1.75} aria-hidden="true" /></Link>;
}

// Handy: Burger-Knopf mit ausklappbarer Liste (Desktop-Navigation ist dort ausgeblendet).
export function MobileMenu({ signedIn, blog = false }: { signedIn: boolean; blog?: boolean }) {
  const t = useTranslations("common.nav");
  const c = useTranslations("common");
  const [open, setOpen] = useState(false);
  const ref = useDismiss(open, () => setOpen(false));
  return (
    <div className="mobile-menu" ref={ref}>
      <button type="button" className="burger" aria-expanded={open} aria-controls="mobile-panel" aria-label={open ? t("close") : t("open")} onClick={() => setOpen((v) => !v)}>
        {open ? <X size={22} /> : <Menu size={22} />}
      </button>
      {open && (
        <div className="mpanel" id="mobile-panel">
          {ITEMS.map(([k, Icon, href]) => (
            <Link key={k} href={href} onClick={() => setOpen(false)}><Icon size={20} strokeWidth={1.6} aria-hidden="true" />{t(`menu.${k}.title`)}</Link>
          ))}
          {(blog ? [BLOG, ...MORE] : MORE).map(([k, Icon, href]) => (
            <Link key={k} href={href} onClick={() => setOpen(false)}><Icon size={20} strokeWidth={1.6} aria-hidden="true" />{t(`menu.${k}.title`)}</Link>
          ))}
          <Link href="/security" onClick={() => setOpen(false)}><ShieldCheck size={20} strokeWidth={1.6} aria-hidden="true" />{t("security")}</Link>
          <Link href={signedIn ? "/new" : "/login"} className="btn primary" onClick={() => setOpen(false)}>{signedIn ? c("toApp") : c("login")}</Link>
        </div>
      )}
    </div>
  );
}
