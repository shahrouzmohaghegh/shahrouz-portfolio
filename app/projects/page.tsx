import type { Metadata } from "next";

import { FilteredListing } from "@/components/capability-filter";
import { SiteFrame } from "@/components/site-frame";
import { projectsPage } from "@/content/projects-page";
import { isFiltered, listingTitle, projectItems, selectionFrom, type ListingSearchParams } from "@/lib/evidence";
// The listing treatment is the /experience one, shared rather than copied.
import styles from "../experience/experience.module.css";

type ListingProps = { readonly searchParams: Promise<ListingSearchParams> };

// The title carries the filter state (AD-3), and a filtered view is never
// indexed (AD-16), so the counted titles never compete with the listing.
export async function generateMetadata({ searchParams }: ListingProps): Promise<Metadata> {
  const selection = selectionFrom(await searchParams);
  return {
    title: listingTitle("project", selection, projectItems),
    description: projectsPage.description,
    ...(isFiltered(selection) ? { robots: { index: false } } : {}),
  };
}

// The project listing (Story 3.5, Epic 4), as /experience lists case
// studies: the h1, one intro line, then the capability filter and the
// projects it selects, titles as h2 under the h1. The route passes the
// collection whole and lists no item itself. It reads search params, so it
// renders per request (AD-4), and it hydrates no island: every chip, card
// and link is in the HTML with JavaScript off.
export default async function ProjectsPage({ searchParams }: ListingProps) {
  const selection = selectionFrom(await searchParams);
  return (
    <SiteFrame current="/projects">
      <div className={styles.listing}>
        <h1 className={styles.title}>{projectsPage.heading}</h1>
        <p className={styles.intro}>{projectsPage.intro}</p>
        <FilteredListing kind="project" selection={selection} items={projectItems} ctaLabel={projectsPage.cta} emptyText={projectsPage.empty} />
      </div>
    </SiteFrame>
  );
}
