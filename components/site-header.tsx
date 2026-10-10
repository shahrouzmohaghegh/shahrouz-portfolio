import Link from "next/link";

import { site } from "@/content/site";
import styles from "./site-header.module.css";

export type NavCurrent = "/" | "/experience" | "/projects" | "/contact" | null;

const NAV_ITEMS = [
  { href: "/experience", label: "Experience" },
  { href: "/projects", label: "Projects" },
  { href: "/contact", label: "Contact" },
] as const;

const ariaCurrent = (isCurrent: boolean): "page" | undefined => (isCurrent ? "page" : undefined);

// Wordmark then three inline items at every width: no menu, panel or focus
// trap. Below 375px the items may wrap; they never scroll sideways.
export function SiteHeader({ current }: { current: NavCurrent }) {
  return (
    <header className={styles.header}>
      <nav aria-label="Primary" className={styles.nav}>
        <Link href="/" className={styles.wordmark} aria-current={ariaCurrent(current === "/")}>
          {site.name}
        </Link>
        <ul className={styles.items}>
          {NAV_ITEMS.map(({ href, label }) => (
            <li key={href}>
              <Link href={href} className={styles.item} aria-current={ariaCurrent(current === href)}>
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}
