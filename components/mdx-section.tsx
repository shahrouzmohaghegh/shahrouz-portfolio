import type { ReactNode } from "react";

import { CASE_STUDY_SECTIONS, PROJECT_SECTIONS } from "@/lib/evidence";
import styles from "./mdx-section.module.css";

export type SectionProps = { readonly name: string; readonly children?: ReactNode };

export const sectionHeadingId = (name: string): string => `${name}-heading`;

// Every section name either kind may use, once each. A name both kinds use
// (decisions, outcome, lessons) has one label, which lib/evidence.test.ts
// pins.
const SECTIONS = [...CASE_STUDY_SECTIONS, ...PROJECT_SECTIONS.filter((p) => !CASE_STUDY_SECTIONS.some((c) => c.id === p.id))];

// One of a written case study's five sections or a written project's eight,
// as the MDX writes it: <Section name="context">...</Section>.
// mdx-components.tsx hands it to every MDX file, so the prose imports
// nothing. The h2's words come from CASE_STUDY_SECTIONS or PROJECT_SECTIONS,
// never from the MDX, so the rail and the headings cannot drift. The section
// is the rail anchor's target and takes focus when the anchor is activated,
// hence tabindex="-1". An unknown name fails the build here; a name from the
// other kind's list, or the right names in the wrong order, fails the
// integrity suite in lib/evidence.test.ts, naming the slug.
export function Section({ name, children }: SectionProps) {
  const section = SECTIONS.find((each) => each.id === name);
  if (section === undefined) {
    throw new Error(
      `<Section name="${name}"> is not a case-study section or a project section; use one of ${SECTIONS.map((each) => each.id).join(", ")}`,
    );
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
