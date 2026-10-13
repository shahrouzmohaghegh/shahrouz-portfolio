// Case Study metadata. Prose lives beside each entry in <slug>.mdx (AD-5).
// Every figure carries its scope in the qualifier (FR-34).

import type { CaseStudy } from "@/lib/evidence-types";

export const caseStudies: readonly CaseStudy[] = [
  {
    slug: "offshore-delivery-turnaround",
    kind: "case-study",
    title: "Offshore delivery turnaround",
    summary:
      "Hired and ran the Vietnam team as a direct extension of Sydney, with KPI-driven governance, shift-left quality and one set of engineering standards across both sites.",
    capabilities: ["leadership"],
    headlineMetric: {
      value: "Bad fixes cut by more than 80%",
      qualifier: "on the Vietnam team, part of the 38-person function across Sydney and Vietnam",
    },
    href: "/experience/offshore-delivery-turnaround",
  },
  {
    slug: "ai-native-engineering",
    kind: "case-study",
    title: "AI-native engineering, measured",
    summary:
      "Cycle time, throughput and adoption measured across pilot projects, and the governance pack that unblocked the capability, carried through the governance board review.",
    capabilities: ["ai-native"],
    headlineMetric: {
      value: "Delivery throughput up 25 to 30%",
      qualifier: "across pilot projects",
    },
    href: "/experience/ai-native-engineering",
  },
  {
    slug: "digital-governance-board",
    kind: "case-study",
    title: "A standing seat on the Digital Governance Board",
    summary:
      "A two-year seat on the Digital Governance Board, reporting to the CEO, with cloud security posture and remediation progress visible to that board.",
    capabilities: ["executive-influence"],
    headlineMetric: {
      value: "Reported directly to the CEO and held a standing role in executive digital governance.",
      qualifierNotRequired: true,
    },
    href: "/experience/digital-governance-board",
  },
];

// The case studies whose <slug>.mdx is written, in collection order. Only
// these get a page: proxy.ts answers every other /experience/<slug> with the
// case-study not-found page and a 404. Add a slug here in the same change
// that writes its MDX; lib/evidence.test.ts fails while the two disagree.
export const writtenCaseStudySlugs: readonly string[] = [
  "offshore-delivery-turnaround",
  "ai-native-engineering",
  "digital-governance-board",
];
