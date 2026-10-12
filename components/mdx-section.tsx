import type { ReactNode } from "react";

import { CASE_STUDY_SECTIONS } from "@/lib/evidence";
import styles from "./mdx-section.module.css";

export type SectionProps = { readonly name: string; readonly children?: ReactNode };

export const sectionHeadingId = (name: string): string => `${name}-heading`;

// One of a written case study's five sections, as the MDX writes it:
// <Section name="context">...</Section>. mdx-components.tsx hands it to
// every MDX file, so the prose imports nothing. The h2's words come from
// CASE_STUDY_SECTIONS, never from the MDX, so the rail and the headings
// cannot drift. The section is the rail anchor's target and takes focus
// when the anchor is activated, hence tabindex="-1". An unknown name fails
// the build here and the integrity suite in lib/evidence.test.ts.
export function Section({ name, children }: SectionProps) {
  const section = CASE_STUDY_SECTIONS.find((each) => each.id === name);
  if (section === undefined) {
    throw new Error(`<Section name="${name}"> is not a case-study section; use one of ${CASE_STUDY_SECTIONS.map((each) => each.id).join(", ")}`);
  }
  const headingId = sectionHeadingId(name);
  return (
    <section id={section.id} aria-labelledby={headingId} tabIndex={-1} className={styles.section}>
      <h2 id={headingId} className={styles.heading}>
        {section.label}
      </h2>
      {children}
    </section>
  );
}
