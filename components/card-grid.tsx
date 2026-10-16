import type { EvidenceItem } from "@/lib/evidence";
import { EvidenceCard } from "./evidence-card";
import styles from "./card-grid.module.css";

export type CardGridProps = {
  readonly items: readonly EvidenceItem[];
  // Passed through to every card: the CTA's words come from the surface
  // (the card never imports content/), and so does the title's level.
  readonly ctaLabel: string;
  readonly headingLevel: 2 | 3;
};

// The one grid of evidence cards (Story 3.1), shared by Home's Selected work
// and the /experience listing: a list with one card per item it is given, in
// that order. A Server Component; it lists no item itself. data-card-grid is
// the stable hook scripts/check-a11y.mts finds every grid by at 768px.
export function CardGrid({ items, ctaLabel, headingLevel }: CardGridProps) {
  return (
    <ul className={styles.grid} data-card-grid="">
      {items.map((item) => (
        <li key={item.slug} className={styles.item}>
          <EvidenceCard item={item} ctaLabel={ctaLabel} headingLevel={headingLevel} />
        </li>
      ))}
    </ul>
  );
}
