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

// Each capability's full name, as the card eyebrow and the filter show it.
// Keyed in CAPABILITIES order; the satisfies clause makes a missing or extra
// key a type error.
export const CAPABILITY_NAME = {
  leadership: "Engineering Leadership",
  "ai-native": "AI-Native Engineering",
  "executive-influence": "Executive and Stakeholder Influence",
  "hands-on": "Hands-On Engineering",
} as const satisfies Record<Capability, string>;

// Each capability's chip label (EXPERIENCE.md Capability chip): the short
// form, used on the filter chips only. Headings, cards, the state line and
// the title always use CAPABILITY_NAME.
export const CAPABILITY_CHIP_LABEL = {
  leadership: "Leadership",
  "ai-native": "AI-Native",
  "executive-influence": "Executive Influence",
  "hands-on": "Hands-On",
} as const satisfies Record<Capability, string>;

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
  // A project's public source (Story 3.5): the detail page's repository call
  // to action links here, and a project without one renders none. Only a
  // Project may carry it; Story 3.6 checks every one answers and none is
  // private.
  readonly repository?: `https://${string}`;
}

export interface CaseStudy extends EvidenceItem {
  readonly kind: "case-study";
  readonly href: `${(typeof EVIDENCE_ROUTE)["case-study"]}/${string}`;
  readonly repository?: never;
}

export interface Project extends EvidenceItem {
  readonly kind: "project";
  readonly href: `${(typeof EVIDENCE_ROUTE)["project"]}/${string}`;
}
