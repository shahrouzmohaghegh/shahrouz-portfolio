// Type-level guarantees of the content model (FR-2, FR-3, AD-7), compiled by
// `npm run typecheck`. Each @ts-expect-error marks a state that must not
// compile; if the types ever accept one, the directive is unused and the
// type check fails. Nothing here runs.

import type { EvidenceItem, HeadlineMetric } from "@/lib/evidence";

const metric: HeadlineMetric = { value: "1 to 2", qualifier: "in one place" };

// A valid item compiles.
export const valid: EvidenceItem = {
  slug: "valid",
  kind: "project",
  title: "Valid",
  summary: "Valid.",
  capabilities: ["leadership", "hands-on"],
  headlineMetric: metric,
  href: "/projects/valid",
};

export const unqualifiedByChoice: HeadlineMetric = { value: "Public repository", qualifierNotRequired: true };

export const unknownCapability: EvidenceItem = {
  ...valid,
  // @ts-expect-error A Capability outside the closed set.
  capabilities: ["devops"],
};

export const emptyCapabilities: EvidenceItem = {
  ...valid,
  // @ts-expect-error Zero Capabilities.
  capabilities: [],
};

// @ts-expect-error No Headline Metric.
export const missingMetric: EvidenceItem = {
  slug: "missing-metric",
  kind: "project",
  title: "Missing metric",
  summary: "Missing metric.",
  capabilities: ["hands-on"],
  href: "/projects/missing-metric",
};

// @ts-expect-error A value with neither a qualifier nor the flag.
export const bareValue: HeadlineMetric = { value: "95%" };

// @ts-expect-error Both a qualifier and the flag.
export const bothKeys: HeadlineMetric = { value: "95%", qualifier: "somewhere", qualifierNotRequired: true };

// @ts-expect-error The flag is only ever true.
export const flagFalse: HeadlineMetric = { value: "95%", qualifierNotRequired: false };
