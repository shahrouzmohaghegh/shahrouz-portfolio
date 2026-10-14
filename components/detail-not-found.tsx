import Link from "next/link";

import styles from "./detail-not-found.module.css";

export type DetailNotFoundProps = {
  readonly heading: string;
  readonly body: string;
  // The matching listing first, then the other listing, then Home.
  readonly links: ReadonlyArray<{ readonly href: string; readonly label: string }>;
};

// The one not-found treatment for a detail route (AD-23, EXPERIENCE.md Not
// Found): on paper, an h1, one sentence, then three underlined links out.
// No search and no suggestions. The case-study and project not-found pages
// (each segment's not-found.tsx and its static twin the proxy serves)
// render it inside SiteFrame, each with its own words. The words come from
// the route, since a component never imports evidence copy.
export function DetailNotFound({ heading, body, links }: DetailNotFoundProps) {
  return (
    <div className={styles.notFound}>
      <h1 className={styles.heading}>{heading}</h1>
      <p className={styles.body}>{body}</p>
      <ul className={styles.links}>
        {links.map(({ href, label }) => (
          <li key={href}>
            <Link href={href} className={styles.link}>
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
