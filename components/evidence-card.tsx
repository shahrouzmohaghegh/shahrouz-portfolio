import Link from "next/link";

import { CAPABILITY_NAME, type EvidenceItem } from "@/lib/evidence";
import styles from "./evidence-card.module.css";

export type EvidenceCardProps = {
  readonly item: EvidenceItem;
  // The CTA's words come from the surface that renders the card, since the
  // card never imports content/ (AD-6, AD-10).
  readonly ctaLabel: string;
  // The title's heading level, so no surface skips one: h3 under Home's
  // "Selected work" h2, h2 directly under a listing's h1.
  readonly headingLevel: 2 | 3;
};

// The metric and its qualifier as one sentence (FR-34), or the value alone
// when the item says no qualifier is required.
export const metricSentence = ({ headlineMetric }: EvidenceItem): string =>
  "qualifier" in headlineMetric && headlineMetric.qualifier
    ? `${headlineMetric.value} ${headlineMetric.qualifier}`
    : headlineMetric.value;

// {components.evidence-card}, built once (Story 2.6) and reused by Epic 3's
// listings. A Server Component that reads only EvidenceItem from
// lib/evidence. Top to bottom: one eyebrow per capability in full-name form
// (already in canonical order), the h2 or h3 title whose whole text is the link,
// the metric sentence, the summary, then the CTA to the same href. The card
// is not a click target as a whole: the two links are the targets. Every CTA
// shares its words, so it is described by the title link, which tells the
// CTAs apart in a screen reader's links list.
export const cardTitleId = (slug: string): string => `card-title-${slug}`;

export function EvidenceCard({ item, ctaLabel, headingLevel }: EvidenceCardProps) {
  const titleId = cardTitleId(item.slug);
  const Title = headingLevel === 2 ? "h2" : "h3";
  return (
    <article className={styles.card}>
      <ul className={styles.eyebrows}>
        {item.capabilities.map((capability) => (
          <li key={capability} className={styles.eyebrow}>
            {CAPABILITY_NAME[capability]}
          </li>
        ))}
      </ul>
      <Title className={styles.title}>
        <Link id={titleId} href={item.href} className={styles.titleLink}>
          {item.title}
        </Link>
      </Title>
      <p className={styles.metric}>{metricSentence(item)}</p>
      <p className={styles.summary}>{item.summary}</p>
      <p className={styles.more}>
        <Link href={item.href} className={styles.cta} aria-describedby={titleId}>
          {ctaLabel}
        </Link>
      </p>
    </article>
  );
}
