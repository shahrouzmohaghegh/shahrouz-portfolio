import Link from "next/link";

import { site } from "@/content/site";
import styles from "./site-footer.module.css";

const [emailUser, emailDomain] = site.email.split("@");

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
            {site.evidenceLinks.map(({ href, label }) => (
              <li key={href}>
                <Link href={href} className={styles.link}>
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className={styles.label}>{site.contactLabel}</p>
          <ul className={styles.links}>
            <li>
              {/* Lightly obfuscated as in the mockup: the visible "@" is hidden from
                  assistive technology, which reads a visually hidden one instead,
                  so the address is never one contiguous text run. */}
              <a href={`mailto:${site.email}`} className={styles.link}>
                {emailUser}
                <span aria-hidden="true">@</span>
                <span className={styles.visuallyHidden}>@</span>
                {emailDomain}
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
