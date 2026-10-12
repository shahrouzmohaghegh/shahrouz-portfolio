import type { Metadata } from "next";

import { CardGrid } from "@/components/card-grid";
import { SiteFrame } from "@/components/site-frame";
import { experience } from "@/content/experience";
import { caseStudyItems, listingTitle } from "@/lib/evidence";
import styles from "./experience.module.css";

export const metadata: Metadata = { title: listingTitle("case-study") };

// The case study listing (Story 3.1): the h1, one intro line, then one
// evidence card per case study in the shared grid, titles as h2 under the h1.
// The route passes the collection whole and lists no item itself, so adding
// or removing a case study needs no edit here. Static, and it hydrates no
// island: every card and link is in the HTML with JavaScript off.
export default function ExperiencePage() {
  return (
    <SiteFrame current="/experience">
      <div className={styles.listing}>
        <h1 className={styles.title}>{experience.heading}</h1>
        <p className={styles.intro}>{experience.intro}</p>
        <CardGrid items={caseStudyItems} ctaLabel={experience.cta} headingLevel={2} />
      </div>
    </SiteFrame>
  );
}
