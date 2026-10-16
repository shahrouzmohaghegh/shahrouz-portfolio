import Link from "next/link";

import { site } from "@/content/site";
import { isListingPath } from "@/lib/evidence";
import { EmailAddress } from "./email-address";
import styles from "./site-footer.module.css";

// {components.footer}: three columns on panel ground, one below 768px.
export function SiteFooter() {
  return (
    <footer className={styles.footer}>
      <div className={styles.columns}>
        <div>
          <p className={styles.wordmark}>{site.name}</p>
          <p className={styles.line}>{site.positioning}</p>
          <p className={styles.line}>{site.location}</p>
          <p className={styles.line}>{site.availability}</p>
        </div>
        <div>
          <p className={styles.label}>{site.evidenceLabel}</p>
          <ul className={styles.links}>
            {/* A listing is a plain anchor, a full page load: a next/link
                move off a filtered listing changes only the search params and
                can keep its stale title (components/capability-filter.tsx). */}
            {site.evidenceLinks.map(({ href, label }) => (
              <li key={href}>
                {isListingPath(href) ? (
                  <a href={href} className={styles.link}>
                    {label}
                  </a>
                ) : (
                  <Link href={href} className={styles.link}>
                    {label}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className={styles.label}>{site.contactLabel}</p>
          <ul className={styles.links}>
            <li>
              {/* Lightly obfuscated as in the mockup (components/email-address.tsx). */}
              <a href={`mailto:${site.email}`} className={styles.link}>
                <EmailAddress address={site.email} />
              </a>
            </li>
            <li>
              <a href={site.linkedin.href} className={styles.link}>
                {site.linkedin.label}
              </a>
            </li>
          </ul>
        </div>
      </div>
      <p className={styles.note}>{site.cvNote}</p>
    </footer>
  );
}
