import type { Metadata } from "next";

import { FilteredListing } from "@/components/capability-filter";
import { SiteFrame } from "@/components/site-frame";
import { experience } from "@/content/experience";
import { caseStudyItems, isFiltered, listingHref, listingTitle, selectionFrom, type ListingSearchParams } from "@/lib/evidence";
import styles from "./experience.module.css";

type ListingProps = { readonly searchParams: Promise<ListingSearchParams> };

// The title carries the filter state (AD-3), and a filtered view is never
// indexed (AD-16), so the counted titles never compete with the listing.
// The canonical URL is the canonical spelling of the parsed selection, so a
// junk or out-of-order spelling names the one page it duplicates (the
// unfiltered listing when nothing valid is selected).
export async function generateMetadata({ searchParams }: ListingProps): Promise<Metadata> {
  const selection = selectionFrom(await searchParams);
  return {
    title: listingTitle("case-study", selection, caseStudyItems),
    alternates: { canonical: listingHref("case-study", selection) },
    description: experience.description,
    ...(isFiltered(selection) ? { robots: { index: false } } : {}),
  };
}

// The case study listing (Story 3.1, Epic 4): the h1, one intro line, then
// the capability filter and the case studies it selects, titles as h2 under
// the h1. The route passes the collection whole and lists no item itself, so
// adding or removing a case study needs no edit here. It reads search
// params, so it renders per request (AD-4), and it hydrates no island: every
// chip, card and link is in the HTML with JavaScript off.
export default async function ExperiencePage({ searchParams }: ListingProps) {
  const selection = selectionFrom(await searchParams);
  return (
    <SiteFrame current="/experience">
      <div className={styles.listing}>
        <h1 className={styles.title}>{experience.heading}</h1>
        <p className={styles.intro}>{experience.intro}</p>
        <FilteredListing kind="case-study" selection={selection} items={caseStudyItems} ctaLabel={experience.cta} emptyText={experience.empty} />
      </div>
    </SiteFrame>
  );
}
