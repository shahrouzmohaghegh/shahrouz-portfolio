import type { Metadata } from "next";

import { CardGrid } from "@/components/card-grid";
import { SiteFrame } from "@/components/site-frame";
import { projectsPage } from "@/content/projects-page";
import { listingTitle, projectItems } from "@/lib/evidence";
// The listing treatment is the /experience one, shared rather than copied.
import styles from "../experience/experience.module.css";

export const metadata: Metadata = { title: listingTitle("project"), description: projectsPage.description };

// The project listing (Story 3.5), as /experience lists case studies: the
// h1, one intro line, then one evidence card per project in the shared
// grid, titles as h2 under the h1. The route passes the collection whole and
// lists no item itself. Static, and it hydrates no island: every card and
// link is in the HTML with JavaScript off.
export default function ProjectsPage() {
  return (
    <SiteFrame current="/projects">
      <div className={styles.listing}>
        <h1 className={styles.title}>{projectsPage.heading}</h1>
        <p className={styles.intro}>{projectsPage.intro}</p>
        <CardGrid items={projectItems} ctaLabel={projectsPage.cta} headingLevel={2} />
      </div>
    </SiteFrame>
  );
}
