import Link from "next/link";

import { home } from "@/content/home";
import type { EvidenceItem } from "@/lib/evidence";
import { CardGrid } from "./card-grid";
import styles from "./selected-work.module.css";

export type SelectedWorkProps = {
  readonly items: readonly EvidenceItem[];
};

// Home's Selected work (Story 2.6, FR-1, FR-7): an h2 section below the
// evidence bands with one evidence card per item it is given, in that order
// (in the shared CardGrid, card titles as h3 under the section's h2),
// then a cross-link to /experience. The route passes the collection and never
// lists items itself, so adding or removing an Evidence Item changes Home
// with no edit to app/page.tsx. A Server Component, and not a reveal target:
// it is fully visible with JavaScript off.
export function SelectedWork({ items }: SelectedWorkProps) {
  const { heading, cta, crossLink } = home.selectedWork;
  return (
    <section className={styles.section} aria-labelledby="selected-work">
      <h2 id="selected-work" className={styles.heading}>
        {heading}
      </h2>
      <CardGrid items={items} ctaLabel={cta} headingLevel={3} />
      <p className={styles.crossLink}>
        <Link href={crossLink.href} className={styles.crossLinkAnchor}>
          {crossLink.label} <span aria-hidden="true">&#8594;</span>
        </Link>
      </p>
    </section>
  );
}
