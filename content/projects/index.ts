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
      value: "Guardrails are scripts, not intentions",
      qualifierNotRequired: true,
    },
    href: "/projects/career-application-system",
    repository: "https://github.com/shahrouzmohaghegh/career-application-system",
  },
  {
    slug: "this-website",
    kind: "project",
    title: "This website",
    summary:
      "Next.js, React and TypeScript, built with BMAD agents while he held the requirements, architecture, decisions and acceptance criteria.",
    capabilities: ["hands-on"],
    headlineMetric: {
      value: "Twelve automated checks run on every merge to main",
      qualifierNotRequired: true,
    },
    href: "/projects/this-website",
    repository: "https://github.com/shahrouzmohaghegh/shahrouz-portfolio",
  },
  {
    slug: "platform-modernisation",
    kind: "project",
    title: "Platform modernisation and upgrade work",
    summary:
      "Microservices taken from .NET 8 to .NET 10 using agentic loops, and a reporting service reshaped onto containerised .NET Core on AKS in 8 weeks with no disruption.",
    capabilities: ["hands-on"],
    headlineMetric: {
      value: "Unit test coverage from near zero to 95%",
      qualifier:
        "on an enterprise Angular application across eight major versions, Angular 13 to 21, driven through agentic loops",
    },
    href: "/projects/platform-modernisation",
  },
];

// The projects whose <slug>.mdx is written, in collection order. Only these
// get a page: proxy.ts answers every other /projects/<slug> with the project
// not-found page and a 404. Add a slug here in the same change that writes
// its MDX (Story 3.7); lib/evidence.test.ts fails while the two disagree.
export const writtenProjectSlugs: readonly string[] = ["career-application-system", "this-website", "platform-modernisation"];
