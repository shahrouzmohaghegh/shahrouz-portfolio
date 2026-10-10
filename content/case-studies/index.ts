// Case Study metadata. Prose lives beside each entry in <slug>.mdx (AD-5).
// Every figure carries its scope in the qualifier (FR-34).

import type { CaseStudy } from "@/lib/evidence-types";

export const caseStudies: readonly CaseStudy[] = [
  {
    slug: "offshore-delivery-turnaround",
    kind: "case-study",
    title: "Offshore delivery turnaround",
    summary:
      "Hired and ran a 26-person Vietnam team as a direct extension of Sydney, with KPI-driven governance, shift-left quality and one set of engineering standards across both sites.",
    capabilities: ["leadership"],
    headlineMetric: {
      value: "Bad fixes cut by more than 80%",
      qualifier: "on the 26-person Vietnam team, part of the 38-person function",
    },
    href: "/experience/offshore-delivery-turnaround",
  },
  {
    slug: "ai-native-engineering",
    kind: "case-study",
    title: "AI-native engineering, measured",
    summary:
      "Cycle time, throughput and adoption measured across pilot projects, and the governance pack that unblocked the capability, carried through the AI governance board review.",
    capabilities: ["ai-native"],
    headlineMetric: {
      value: "Cycle time down 30 to 40%",
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
      value: "Cloud Secure Score from 20% to 76%",
      qualifier: "across the full production subscription",
    },
    href: "/experience/digital-governance-board",
  },
];
