import { figureRole } from "@/lib/figure-role";
import styles from "./evidence-band.module.css";

export type EvidenceBandProps = {
  readonly tone: "deep" | "paper";
  readonly tag: string;
  readonly figure: string;
  readonly caption: string;
};

// {components.evidence-band}: below the fold on Home (Story 2.5). One caps
// tag (an h2 styled as a meta-label), one figure and one caption; nothing else may enter it. It carries the
// global class `reveal`, so RevealOnScroll fades it in, and it is at rest
// whenever that island does not run (styles/reveal.css). The figure's type
// role follows Figure demotion by length; a band holds one figure, so step
// two never applies.
// The tag is the band's h2 and names the section; the id is derived from it,
// so tags must stay unique on a page.
export const bandHeadingId = (tag: string): string =>
  `band-${tag.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;

export function EvidenceBand({ tone, tag, figure, caption }: EvidenceBandProps) {
  const headingId = bandHeadingId(tag);
  return (
    <section className={`${styles.band} ${styles[tone]} reveal`} aria-labelledby={headingId}>
      <h2 id={headingId} className={styles.tag}>
        {tag}
      </h2>
      <p className={styles.figure} data-figure-role={figureRole(figure)}>
        {figure}
      </p>
      <p className={styles.caption}>{caption}</p>
    </section>
  );
}
