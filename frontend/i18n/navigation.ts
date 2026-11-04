import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

// Locale-bewusste Links: <Link href="/new"> wird zu /de/new bzw. /en/new.
export const { Link, useRouter, usePathname } = createNavigation(routing);
