import Link from "next/link";

import { site } from "@/content/site";
import { isListingPath } from "@/lib/evidence";
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
              {/* A listing is a plain anchor, a full page load: a next/link
                  move off a filtered listing changes only the search params
                  and can keep its stale title (components/capability-filter.tsx). */}
              {isListingPath(href) ? (
                <a href={href} className={styles.item} aria-current={ariaCurrent(current === href)}>
                  {label}
                </a>
              ) : (
                <Link href={href} className={styles.item} aria-current={ariaCurrent(current === href)}>
                  {label}
                </Link>
              )}
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}
