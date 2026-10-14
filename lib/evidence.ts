// The content model's one entry point (AD-6, AD-13). Every Case Study and
// Project is defined once, in content/<collection>/index.ts, and every
// surface reads it through EvidenceItem from here, never through CaseStudy or
// Project and never from content/ directly. The types live in the leaf
// lib/evidence-types.ts; the Vitest suite in lib/evidence.test.ts checks what
// types cannot (slugs, MDX files, hrefs).
//
// This module alone will own parsing, filtering and serialising the
// capability parameter (AD-13); that arrives with the filter.

import type { MDXContent } from "mdx/types";

import { caseStudies, writtenCaseStudySlugs } from "@/content/case-studies";
import { projects, writtenProjectSlugs } from "@/content/projects";
import { CAPABILITIES, type Capabilities, type EvidenceItem, type EvidenceKind } from "@/lib/evidence-types";

// Everything consumers need, and not CaseStudy or Project (AD-6).
export {
  CAPABILITIES,
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

// The one listing title (AD-16): /experience and /projects both export
// metadata.title from it, so no route composes its own. It returns the bare
// segment, and the root layout's template adds " | Shahrouz Mohaghegh", so
// the suffix appears once. Unfiltered only; Epic 4 extends it with the
// selected capability.
const LISTING_TITLE = { "case-study": "Experience", project: "Projects" } as const satisfies Record<EvidenceKind, string>;

export function listingTitle(kind: EvidenceKind): string {
  return LISTING_TITLE[kind];
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
    label: "What it cost",
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

const ITEMS = { "case-study": caseStudyItems, project: projectItems } as const satisfies Record<EvidenceKind, readonly EvidenceItem[]>;

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
