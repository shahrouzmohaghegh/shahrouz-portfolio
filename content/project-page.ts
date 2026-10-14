// The project detail route's own copy (Story 3.5): the eyebrow before the
// capability names, the section rail's label and accessible name, the
// repository call to action's words, the next link's words and the
// not-found page. The project itself (title, summary, capabilities,
// repository, prose) comes from lib/evidence, never from here. The rail's
// group headers sit with the sections in lib/evidence.ts. It lives under
// content/ so the content review box gates every word of it. Not evidence:
// AD-6 governs Case Studies and Projects only, so the route may import this
// file directly.

export const projectPage = {
  eyebrow: "Project",
  railLabel: "On this page",
  railAriaLabel: "Sections of this project",
  nextLabel: "Next project",
  // The repository call to action, in the panel and its rail repeat alike,
  // so both carry the same accessible name.
  repository: { kicker: "Repository", title: "Open the repository on GitHub" },
  notFound: {
    // The browser tab title; the root template adds the site name once.
    title: "Project not available",
    heading: "This project is not available.",
    body: "The page may have moved, or the link may be incomplete.",
    // The matching listing first, then the other listing, then Home (EXPERIENCE.md Not Found).
    links: [
      { href: "/projects", label: "Projects" },
      { href: "/experience", label: "Experience" },
      { href: "/", label: "Home" },
    ],
  },
} as const;
