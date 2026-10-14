// The /projects listing's own copy (Story 3.5): its h1, its meta
// description, the one intro line under it and the card CTA. The cards come
// from lib/evidence, never from here. It lives under content/ so the content
// review box gates every word of it. Not evidence: AD-6 governs Case Studies
// and Projects only, so the route may import this file directly. The intro
// promises no filter: Epic 4 adds that when it exists.

export const projectsPage = {
  heading: "Projects",
  // The meta description for /projects: what search results and link previews show.
  description:
    "Projects in hands-on engineering: a governed multi-agent system, this website, and platform modernisation through agentic loops.",
  intro: "Systems I built, each with the decisions behind it, what they cost, and how they were tested.",
  cta: "Read the project",
} as const;
