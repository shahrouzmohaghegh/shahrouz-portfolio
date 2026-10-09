// The content model's types and constants (AD-5, AD-6, AD-7). A leaf: it
// imports nothing, so content/ can import from here while lib/evidence.ts
// imports content/ without a cycle. Consumers import from lib/evidence.ts.
//
// The types make the invalid states unrepresentable: a Capability outside the
// closed set, an empty capability list, a missing Headline Metric, and a
// metric value with neither a qualifier nor an explicit qualifierNotRequired.
// lib/evidence.type-test.ts proves each one is a type error.

// Canonical chip order (EXPERIENCE.md). Items are exposed in this order
// whatever order they declare.
export const CAPABILITIES = ["leadership", "ai-native", "executive-influence", "hands-on"] as const;

export type Capability = (typeof CAPABILITIES)[number];

// One or more, never zero.
export type Capabilities = readonly [Capability, ...Capability[]];

// A scoped figure carries its scope (FR-34). A figure that needs none says so
// explicitly. Neither member accepts the other's key.
export type HeadlineMetric =
  | { readonly value: string; readonly qualifier: string; readonly qualifierNotRequired?: never }
  | { readonly value: string; readonly qualifierNotRequired: true; readonly qualifier?: never };

// The path prefix of each kind's detail route.
export const EVIDENCE_ROUTE = { "case-study": "/experience", project: "/projects" } as const;

export type EvidenceKind = keyof typeof EVIDENCE_ROUTE;

export interface EvidenceItem {
  readonly slug: string;
  readonly kind: EvidenceKind;
  readonly title: string;
  readonly summary: string;
  readonly capabilities: Capabilities;
  readonly headlineMetric: HeadlineMetric;
  readonly href: string;
}

export interface CaseStudy extends EvidenceItem {
  readonly kind: "case-study";
  readonly href: `${(typeof EVIDENCE_ROUTE)["case-study"]}/${string}`;
}

export interface Project extends EvidenceItem {
  readonly kind: "project";
  readonly href: `${(typeof EVIDENCE_ROUTE)["project"]}/${string}`;
}
