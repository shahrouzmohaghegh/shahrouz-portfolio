import { figureRole } from "@/lib/figure-role";
import styles from "./evidence-band.module.css";

export type EvidenceBandProps = {
  readonly tone: "deep" | "paper";
  readonly tag: string;
  readonly figure: string;
  readonly caption: string;
};

// {components.evidence-band}: below the fold on Home (Story 2.5). One caps
// tag, one figure and one caption; nothing else may enter it. It carries the
// global class `reveal`, so RevealOnScroll fades it in, and it is at rest
// whenever that island does not run (styles/reveal.css). The figure's type
// role follows Figure demotion by length; a band holds one figure, so step
// two never applies.
export function EvidenceBand({ tone, tag, figure, caption }: EvidenceBandProps) {
  return (
    <section className={`${styles.band} ${styles[tone]} reveal`}>
      <p className={styles.tag}>{tag}</p>
      <p className={styles.figure} data-figure-role={figureRole(figure)}>
        {figure}
      </p>
      <p className={styles.caption}>{caption}</p>
    </section>
  );
}
