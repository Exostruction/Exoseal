import { notFound } from "next/navigation";

// Unbekannte Pfade unter /de und /en landen so in der übersetzten not-found-Seite.
export default function CatchAll() {
  notFound();
}
