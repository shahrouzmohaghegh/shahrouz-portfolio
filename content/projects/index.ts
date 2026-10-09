// Project metadata. Prose lives beside each entry in <slug>.mdx (AD-5).
// Every figure carries its scope in the qualifier (FR-34).

import type { Project } from "@/lib/evidence-types";

export const projects: readonly Project[] = [
  {
    slug: "career-application-system",
    kind: "project",
    title: "Career Application System",
    summary:
      "A governed multi-agent system with C4 architecture, agent design and toolchain documentation, public on GitHub.",
    capabilities: ["ai-native", "hands-on"],
    headlineMetric: {
      value: "Public repository, audited clean on 2026-09-22",
      qualifierNotRequired: true,
    },
    href: "/projects/career-application-system",
  },
  {
    slug: "this-website",
    kind: "project",
    title: "This website",
    summary:
      "Next.js, React and TypeScript, built with BMAD agents while he held the requirements, architecture, decisions and acceptance criteria.",
    capabilities: ["hands-on"],
    headlineMetric: {
      value: "Public repository",
      qualifierNotRequired: true,
    },
    href: "/projects/this-website",
  },
  {
    slug: "platform-modernisation",
    kind: "project",
    title: "Platform modernisation and upgrade work",
    summary:
      "25 microservices taken from .NET 8 to .NET 10 using agentic loops, and the reporting service reshaped onto containerised .NET Core on AKS in 8 weeks with no disruption.",
    capabilities: ["hands-on"],
    headlineMetric: {
      value: "Unit test coverage from near zero to 95%",
      qualifier:
        "on an enterprise Angular application across eight major versions, Angular 13 to 21, driven through agentic loops",
    },
    href: "/projects/platform-modernisation",
  },
];
