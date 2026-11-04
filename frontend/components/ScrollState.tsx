"use client";

import { useEffect } from "react";

// Setzt data-scrolled am <html>, sobald die Seite nicht mehr ganz oben ist. Der Header wird dann zur schwebenden Fläche.
export function ScrollState() {
  useEffect(() => {
    const root = document.documentElement;
    const sync = () => (window.scrollY > 8 ? root.setAttribute("data-scrolled", "") : root.removeAttribute("data-scrolled"));
    sync();
    window.addEventListener("scroll", sync, { passive: true });
    return () => { window.removeEventListener("scroll", sync); root.removeAttribute("data-scrolled"); };
  }, []);
  return null;
}
