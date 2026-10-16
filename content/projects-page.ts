// The /projects listing's own copy (Story 3.5): its h1, its meta
// description, the one intro line under it and the card CTA. The cards come
// from lib/evidence, never from here. It lives under content/ so the content
// review box gates every word of it. Not evidence: AD-6 governs Case Studies
// and Projects only, so the route may import this file directly. `empty` is
// the explanation the empty state gives when the selected capabilities
// match no project (at launch, Leadership or Executive Influence); the
// cross-listing link to /experience leads it.

export const projectsPage = {
  heading: "Projects",
  // The meta description for /projects: what search results and link previews show.
  description:
    "Projects in hands-on engineering: a governed multi-agent system, this website, and platform modernisation through agentic loops.",
  intro: "Systems I built, each with the decisions behind it, what they cost, and how they were tested.",
  cta: "Read the project",
  empty: "The projects are systems I built. Leadership and stakeholder influence are told through the case studies, on Experience.",
} as const;
