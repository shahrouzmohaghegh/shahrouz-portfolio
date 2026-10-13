// The case-study detail route's own copy (Story 3.2): the eyebrow before the
// capability names, the section rail's label and accessible name, the next
// link's words and the not-found page. The case study itself (title,
// summary, capabilities, prose) comes from lib/evidence, never from here. It
// lives under content/ so the content review box gates every word of it.
// Not evidence: AD-6 governs Case Studies and Projects only, so the route
// may import this file directly.

export const caseStudyPage = {
  eyebrow: "Case study",
  railLabel: "On this page",
  railAriaLabel: "Sections of this case study",
  nextLabel: "Next case study",
  // The trade-off pair's two caps labels (Story 3.3). They carry the
  // distinction in words, so it never rests on the rule weight or position.
  tradeoff: { buys: "What it buys", costs: "What it costs" },
  notFound: {
    // The browser tab title; the root template adds the site name once.
    title: "Case study not available",
    heading: "This case study is not available.",
    body: "The page may have moved, or the link may be incomplete.",
    // The matching listing first, then the other listing, then Home (EXPERIENCE.md Not Found).
    links: [
      { href: "/experience", label: "Experience" },
      { href: "/projects", label: "Projects" },
      { href: "/", label: "Home" },
    ],
  },
} as const;
