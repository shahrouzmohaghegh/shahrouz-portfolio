import { capabilityFilter } from "@/content/capability-filter";
import {
  crossListing,
  filterChips,
  FILTER_STATUS_ID,
  filterItems,
  filterLinkHref,
  stateLine,
  type CrossListing,
  type EvidenceItem,
  type EvidenceKind,
  type Selection,
} from "@/lib/evidence";
import { CardGrid } from "./card-grid";
import styles from "./capability-filter.module.css";

// The capability filter on /experience and /projects (Epic 4, AD-2). Server
// Components only: every chip is a link to the selection it would produce,
// and nothing here hydrates.
//
// The filter links are plain <a> elements, not next/link, so every filter
// change is a full page load, with JavaScript on as with it off. Measured on
// next start with Next.js 16.4.0 (2026-10-15): a next/link navigation that
// changes only the search params renders the right cards but keeps a stale
// document title (the unfiltered or an earlier selection's), although the
// server's response carries the right one. The title is the only
// announcement (AD-3), so a stale one announces the wrong count. A full load
// always gets the server's title. See
// _bmad-output/implementation-artifacts/deferred-work.md before going back.
// The header and footer links to the two listings are plain anchors too.
// Each filter href ends in #filter-status, so the reload lands on the result.
//
// Every string and every href comes from lib/evidence.ts (AD-13); nothing
// here parses or serialises the selection. There is no live region and no
// focus move: the counted document title is the announcement (AD-3).

export type CapabilityChipsProps = { readonly kind: EvidenceKind; readonly selection: Selection };

// A group named by its visible label, wrapping a list (which keeps its list
// semantics) of one link per capability in chip order.
// A selected chip carries aria-current="true", a check glyph hidden from
// assistive technology and the hidden text ", selected"; never aria-pressed.
export function CapabilityChips({ kind, selection }: CapabilityChipsProps) {
  return (
    <div role="group" aria-labelledby="capfilter">
      <p id="capfilter" className={styles.label}>
        {capabilityFilter.groupLabel}
      </p>
      <ul className={styles.chips}>
        {filterChips(kind, selection).map((chip) => (
          <li key={chip.capability}>
            {chip.selected ? (
              <a href={chip.href} className={styles.chip} aria-current="true">
                <span aria-hidden="true">&#10003;</span>
                {chip.label}
                <span className={styles.visuallyHidden}>{capabilityFilter.selectedHint}</span>
              </a>
            ) : (
              <a href={chip.href} className={styles.chip}>
                {chip.label}
              </a>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export type FilterStateLineProps = { readonly kind: EvidenceKind; readonly selection: Selection; readonly items: readonly EvidenceItem[] };

// The written count under the chips. Not focusable and not a live region.
export function FilterStateLine({ kind, selection, items }: FilterStateLineProps) {
  const { emphasis, rest } = stateLine(kind, selection, items);
  return (
    <p id={FILTER_STATUS_ID} className={styles.stateLine}>
      <span className={styles.emphasis}>{emphasis}</span>
      {rest}
    </p>
  );
}

// The link to the other listing's matches, carrying the selection there.
export function CrossListingLink({ link }: { readonly link: CrossListing }) {
  return (
    <p className={styles.crossListing}>
      <a href={link.href} className={styles.crossListingLink}>
        <span className={styles.count}>{link.prefix}</span>
        {link.rest}
      </a>
    </p>
  );
}

export type EmptyStateProps = {
  readonly kind: EvidenceKind;
  readonly link: CrossListing | undefined;
  readonly explanation: string;
};

// What a selection that matches nothing here shows instead of cards: the
// cross-listing link first when the other listing matches, the explanation,
// then the way back to the unfiltered listing.
export function EmptyState({ kind, link, explanation }: EmptyStateProps) {
  return (
    <div className={styles.empty}>
      {link === undefined ? null : <CrossListingLink link={link} />}
      <p className={styles.emptyText}>{explanation}</p>
      <p className={styles.emptyText}>
        <a href={filterLinkHref(kind, [])} className={styles.emptyLink}>
          {capabilityFilter.showAll}
        </a>
      </p>
    </div>
  );
}

export type FilteredListingProps = {
  readonly kind: EvidenceKind;
  readonly selection: Selection;
  // The listing's whole collection; the selection narrows it here.
  readonly items: readonly EvidenceItem[];
  readonly ctaLabel: string;
  readonly emptyText: string;
};

// Everything under a listing's intro, in order: the chips, the state line,
// the cross-listing link when the other listing matches, then the cards, or
// the empty state when nothing here matches (the link then leads it).
export function FilteredListing({ kind, selection, items, ctaLabel, emptyText }: FilteredListingProps) {
  const shown = filterItems(items, selection);
  const link = crossListing(kind, selection);
  return (
    <>
      <CapabilityChips kind={kind} selection={selection} />
      <FilterStateLine kind={kind} selection={selection} items={items} />
      {shown.length === 0 ? (
        <EmptyState kind={kind} link={link} explanation={emptyText} />
      ) : (
        <>
          {link === undefined ? null : <CrossListingLink link={link} />}
          <CardGrid items={shown} ctaLabel={ctaLabel} headingLevel={2} />
        </>
      )}
    </>
  );
}
