// The content model's one entry point (AD-6, AD-13). Every Case Study and
// Project is defined once, in content/<collection>/index.ts, and every
// surface reads it through EvidenceItem from here, never through CaseStudy or
// Project and never from content/ directly. The types live in the leaf
// lib/evidence-types.ts; the Vitest suite in lib/evidence.test.ts checks what
// types cannot (slugs, MDX files, hrefs).
//
// This module alone owns the capability filter (AD-13): parsing the
// capability parameter, its canonical order, serialising it back to a URL,
// the OR predicate, the cross-route counts, the listing title (AD-3) and the
// state line. No route or component reads searchParams.capability itself.

import type { MDXContent } from "mdx/types";

import { caseStudies, writtenCaseStudySlugs } from "@/content/case-studies";
import { projects, writtenProjectSlugs } from "@/content/projects";
import {
  CAPABILITIES,
  CAPABILITY_CHIP_LABEL,
  CAPABILITY_NAME,
  EVIDENCE_ROUTE,
  type Capabilities,
  type Capability,
  type EvidenceItem,
  type EvidenceKind,
} from "@/lib/evidence-types";

// Everything consumers need, and not CaseStudy or Project (AD-6).
export {
  CAPABILITIES,
  CAPABILITY_CHIP_LABEL,
  CAPABILITY_NAME,
  EVIDENCE_ROUTE,
  type Capabilities,
  type Capability,
  type EvidenceItem,
  type EvidenceKind,
  type HeadlineMetric,
} from "@/lib/evidence-types";

// Capabilities in CAPABILITIES order, whatever order they were declared in.
// A stable sort, so nothing is dropped or merged; the suite still sees any
// repeat or unknown value.
export function inCanonicalOrder(capabilities: Capabilities): Capabilities {
  const rank = (capability: string) => (CAPABILITIES as readonly string[]).indexOf(capability);
  return [...capabilities].sort((a, b) => rank(a) - rank(b)) as unknown as Capabilities;
}

function expose(item: EvidenceItem): EvidenceItem {
  return { ...item, capabilities: inCanonicalOrder(item.capabilities) };
}

// The collections, as consumers see them, in index.ts order.
export const caseStudyItems: readonly EvidenceItem[] = caseStudies.map(expose);
export const projectItems: readonly EvidenceItem[] = projects.map(expose);
export const evidenceItems: readonly EvidenceItem[] = [...caseStudyItems, ...projectItems];

const ITEMS = { "case-study": caseStudyItems, project: projectItems } as const satisfies Record<EvidenceKind, readonly EvidenceItem[]>;

// ---------------------------------------------------------------- the filter

// The one query parameter (AD-4), shared by /experience and /projects.
export const CAPABILITY_PARAM = "capability";

// A selection: capabilities in canonical order, each at most once, possibly
// none. Only parseSelection and toggleCapability make one.
export type Selection = readonly Capability[];

export const NO_SELECTION: Selection = [];

const isCapability = (value: string): value is Capability => (CAPABILITIES as readonly string[]).includes(value);

const canonical = (capabilities: Iterable<Capability>): Selection => {
  const chosen = new Set(capabilities);
  return CAPABILITIES.filter((capability) => chosen.has(capability));
};

// Liberal on read (AD-4): comma or %2C separated, case folded, unknown slugs
// dropped, duplicates collapsed, empty treated as absent. A repeated
// parameter is read as one list. All-unknown is no selection, so it renders
// unfiltered.
export function parseSelection(raw: string | readonly string[] | undefined): Selection {
  const values = raw === undefined ? [] : typeof raw === "string" ? [raw] : raw;
  const slugs = values.flatMap((value) => value.split(/,|%2c/i)).map((slug) => slug.trim().toLowerCase());
  return canonical(slugs.filter(isCapability));
}

export type ListingSearchParams = Readonly<Record<string, string | readonly string[] | undefined>>;

// The selection a listing's search params carry. The one place
// searchParams.capability is read.
export function selectionFrom(searchParams: ListingSearchParams | undefined): Selection {
  return parseSelection(searchParams?.[CAPABILITY_PARAM]);
}

export const isFiltered = (selection: Selection): boolean => selection.length > 0;

// Canonical on write: chip order, comma separated, the comma left as is,
// and "" for no selection.
export function serialiseSelection(selection: Selection): string {
  return canonical(selection).join(",");
}

// A listing's URL for a selection: the bare route when nothing is selected,
// so "?capability=" is never emitted.
export function listingHref(kind: EvidenceKind, selection: Selection): string {
  const value = serialiseSelection(selection);
  return value === "" ? EVIDENCE_ROUTE[kind] : `${EVIDENCE_ROUTE[kind]}?${CAPABILITY_PARAM}=${value}`;
}

// The selection with one capability toggled in or out, in canonical order.
export function toggleCapability(selection: Selection, capability: Capability): Selection {
  return selection.includes(capability) ? canonical(selection.filter((each) => each !== capability)) : canonical([...selection, capability]);
}

// The OR predicate: with nothing selected every item matches; otherwise an
// item matches when it carries any selected capability (a union, never an
// intersection).
export function matchesSelection(item: EvidenceItem, selection: Selection): boolean {
  return selection.length === 0 || item.capabilities.some((capability) => selection.includes(capability));
}

// A listing's items for a selection: all of them unfiltered, the union of
// the selected capabilities otherwise, in collection order.
export function filterItems(items: readonly EvidenceItem[], selection: Selection): readonly EvidenceItem[] {
  return items.filter((item) => matchesSelection(item, selection));
}

// The listing each kind's cross-listing link points at.
export const OTHER_KIND = { "case-study": "project", project: "case-study" } as const satisfies Record<EvidenceKind, EvidenceKind>;

// The one joiner (AD-13), shared by the title and the state line: full
// names in canonical order, the last two joined by "or". Between the
// earlier names the state line puts a comma (EXPERIENCE.md, "A, B or C"),
// and the title puts "or" again, since AD-3 forbids a comma list in a title
// whose segments are already comma separated.
export function joinCapabilityNames(selection: Selection, between: ", " | " or " = ", "): string {
  const names = canonical(selection).map((capability) => CAPABILITY_NAME[capability]);
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(between)} or ${names[names.length - 1]}`;
}

// Each listing's noun, singular and plural. The cross-listing prefix names
// the other listing, so Projects is capitalised there as the route is.
const NOUN = {
  "case-study": { one: "case study", many: "case studies" },
  project: { one: "project", many: "projects" },
} as const satisfies Record<EvidenceKind, { one: string; many: string }>;
const CROSS_NOUN = {
  "case-study": { one: "case study", many: "case studies" },
  project: { one: "Project", many: "Projects" },
} as const satisfies Record<EvidenceKind, { one: string; many: string }>;

const noun = (kind: EvidenceKind, count: number): string => (count === 1 ? NOUN[kind].one : NOUN[kind].many);

// The one listing title (AD-3, AD-16): /experience and /projects both take
// their metadata title from it, so no route composes its own. It returns
// the segment before the root layout's " | Shahrouz Mohaghegh" template, so
// the suffix appears once. Four states and no others: unfiltered, one
// capability, several, and no matches. Every distinct selection gives a
// distinct title, because the route announcer only speaks on a change.
const LISTING_TITLE = { "case-study": "Experience", project: "Projects" } as const satisfies Record<EvidenceKind, string>;

export function listingTitle(kind: EvidenceKind, selection: Selection = NO_SELECTION, items: readonly EvidenceItem[] = ITEMS[kind]): string {
  if (!isFiltered(selection)) return LISTING_TITLE[kind];
  const names = joinCapabilityNames(selection, " or ");
  const shown = filterItems(items, selection).length;
  if (shown === 0) return `${LISTING_TITLE[kind]}, no ${NOUN[kind].many} match, ${names}`;
  return `${LISTING_TITLE[kind]}, ${shown} of ${items.length} ${noun(kind, items.length)}, ${names}`;
}

// The visible state line under the chips (EXPERIENCE.md, Exact state-line
// strings): the emphasis, set in ink at 600, then the rest of the sentence.
export type StateLine = { readonly emphasis: string; readonly rest: string };

export function stateLine(kind: EvidenceKind, selection: Selection, items: readonly EvidenceItem[] = ITEMS[kind]): StateLine {
  const total = `${items.length} ${noun(kind, items.length)}`;
  if (!isFiltered(selection)) return { emphasis: `Showing all ${total}.`, rest: " No capability filter applied." };
  const shown = filterItems(items, selection).length;
  return { emphasis: `Showing ${shown} of ${total}`, rest: `, filtered by ${joinCapabilityNames(selection)}.` };
}

// The cross-listing link (FR-19): how many items on the other listing match
// the whole selection, and the link that carries the selection there. None
// when the other listing has no match. Unfiltered, it counts the other
// listing whole.
export type CrossListing = {
  readonly kind: EvidenceKind;
  readonly count: number;
  readonly href: string;
  // The count prefix, set as a meta label, then the rest of the sentence.
  readonly prefix: string;
  readonly rest: string;
};

export function crossListing(
  kind: EvidenceKind,
  selection: Selection,
  otherItems: readonly EvidenceItem[] = ITEMS[OTHER_KIND[kind]],
): CrossListing | undefined {
  const other = OTHER_KIND[kind];
  const count = filterItems(otherItems, selection).length;
  if (count === 0) return undefined;
  const prefix = `${count} ${count === 1 ? CROSS_NOUN[other].one : CROSS_NOUN[other].many}`;
  const rest = isFiltered(selection)
    ? ` also ${count === 1 ? "matches" : "match"} ${joinCapabilityNames(selection)}`
    : ` ${count === 1 ? "is" : "are"} listed separately`;
  return { kind: other, count, href: listingHref(other, selection), prefix, rest };
}

// A filter chip (EXPERIENCE.md, Markup: chips are links): its short label,
// whether it is selected, and the href of the selection it would produce.
export type Chip = { readonly capability: Capability; readonly label: string; readonly selected: boolean; readonly href: string };

export function filterChips(kind: EvidenceKind, selection: Selection): readonly Chip[] {
  return CAPABILITIES.map((capability) => ({
    capability,
    label: CAPABILITY_CHIP_LABEL[capability],
    selected: selection.includes(capability),
    href: listingHref(kind, toggleCapability(selection, capability)),
  }));
}

// The five sections of a written case study, in order (Story 3.2): the id is
// the <Section name="..."> in the MDX and the in-page anchor, the label is
// the section's h2 and its rail item. The Section component, the rail and
// the integrity check in lib/evidence.test.ts all read this one list.
export const CASE_STUDY_SECTIONS = [
  { id: "context", label: "Context" },
  { id: "decisions", label: "Decisions" },
  { id: "actions", label: "Actions" },
  { id: "outcome", label: "Outcome" },
  { id: "lessons", label: "Lessons" },
] as const satisfies ReadonlyArray<{ readonly id: string; readonly label: string }>;

export type CaseStudySectionId = (typeof CASE_STUDY_SECTIONS)[number]["id"];

// The eight sections of a written project, in order, under the three rail
// group headers (Story 3.5, EXPERIENCE.md rail group header): eight sections
// read as three. The headers are rail labels only, never headings, and the
// rail's numbering runs 01 to 08 through them. A section shared with case
// studies (decisions, outcome, lessons) keeps the same label.
export const PROJECT_SECTION_GROUPS = [
  {
    label: "The build",
    sections: [
      { id: "problem", label: "Problem" },
      { id: "approach", label: "Approach" },
      { id: "decisions", label: "Decisions" },
      { id: "technologies", label: "Technologies" },
    ],
  },
  {
    label: "How it held up",
    sections: [
      { id: "tradeoffs", label: "Trade-offs" },
      { id: "testing", label: "Testing" },
    ],
  },
  {
    label: "What came of it",
    sections: [
      { id: "outcome", label: "Outcome" },
      { id: "lessons", label: "Lessons" },
    ],
  },
] as const satisfies ReadonlyArray<{
  readonly label: string;
  readonly sections: ReadonlyArray<{ readonly id: string; readonly label: string }>;
}>;

type ProjectSection = (typeof PROJECT_SECTION_GROUPS)[number]["sections"][number];

export const PROJECT_SECTIONS: readonly ProjectSection[] = PROJECT_SECTION_GROUPS.flatMap(
  (group): readonly ProjectSection[] => group.sections,
);

export type ProjectSectionId = ProjectSection["id"];

export type EvidenceSection = { readonly id: string; readonly label: string };

// Each kind's sections, in order: what its MDX must hold.
export function sectionsOf(kind: EvidenceKind): readonly EvidenceSection[] {
  return kind === "case-study" ? CASE_STUDY_SECTIONS : PROJECT_SECTIONS;
}

// An item gets a page only once its MDX is written: an empty or
// whitespace-only file is unwritten, and its slug 404s like an unknown one.
// The integrity suite applies this to every MDX file and fails while the
// kind's written list disagrees.
export function isWritten(source: string): boolean {
  return source.trim() !== "";
}

// Each kind's committed written list (writtenCaseStudySlugs and
// writtenProjectSlugs in content/<collection>/index.ts, which proxy.ts reads
// too).
const WRITTEN_SLUGS = {
  "case-study": writtenCaseStudySlugs,
  project: writtenProjectSlugs,
} as const satisfies Record<EvidenceKind, readonly string[]>;

// The items of a kind on its committed written list, in collection order.
export function writtenItems(kind: EvidenceKind): readonly EvidenceItem[] {
  const written: readonly string[] = WRITTEN_SLUGS[kind];
  return ITEMS[kind].filter((item) => written.includes(item.slug));
}

// The written item after `slug`, wrapping from the last to the first. None
// when only one is written, or when `slug` is not among them. Callers pass
// one kind's written items, so the next case study is a case study.
export function nextWrittenItem(written: readonly EvidenceItem[], slug: string): EvidenceItem | undefined {
  const at = written.findIndex((item) => item.slug === slug);
  if (at === -1 || written.length < 2) return undefined;
  return written[(at + 1) % written.length];
}

// An item's prose, compiled from content/<collection>/<slug>.mdx by
// @next/mdx (AD-5). One import per collection, so the bundler can see each
// directory.
export async function evidenceBody(kind: EvidenceKind, slug: string): Promise<MDXContent> {
  const mdx = (
    kind === "case-study" ? await import(`@/content/case-studies/${slug}.mdx`) : await import(`@/content/projects/${slug}.mdx`)
  ) as { default: MDXContent };
  return mdx.default;
}
