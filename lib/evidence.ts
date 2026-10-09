// The content model's one entry point (AD-6, AD-13). Every Case Study and
// Project is defined once, in content/<collection>/index.ts, and every
// surface reads it through EvidenceItem from here, never through CaseStudy or
// Project and never from content/ directly. The types live in the leaf
// lib/evidence-types.ts; the Vitest suite in lib/evidence.test.ts checks what
// types cannot (slugs, MDX files, hrefs).
//
// This module alone will own parsing, filtering and serialising the
// capability parameter (AD-13); that arrives with the filter.

import { caseStudies } from "@/content/case-studies";
import { projects } from "@/content/projects";
import { CAPABILITIES, type Capabilities, type EvidenceItem } from "@/lib/evidence-types";

// Everything consumers need, and not CaseStudy or Project (AD-6).
export {
  CAPABILITIES,
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
