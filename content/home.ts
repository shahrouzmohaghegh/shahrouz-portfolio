// Home's own copy: the hero (Story 2.3) and its figure pair (Story 2.4). His
// name and the availability line come from content/site.ts, the source the
// header and footer share. It lives under content/ so the content review box
// gates every word of it. Not evidence: AD-6 governs Case Studies and
// Projects only, so components may import this file directly.

export const home = {
  // FR-4: one statement at every width, 40 to 45 words, leadership scope first.
  statement:
    "Engineering leader in regulated industries, most recently running a 38-person function through six people-managers, with a standing seat on the Digital Governance Board, reporting to the CEO. Twenty years across banking, payments and healthcare, hands-on throughout, with AI-native delivery measured rather than assumed.",
  // Rendered from 768px only; it does not render at 375px.
  kicker: "Cloud · Engineering · AI",
  // UX-DR27: each label carries the figure's scope on one caps line.
  figurePair: [
    { label: "Bug reopen rate, 26 in Vietnam of 38", figure: "above 100% to below 20%" },
    { label: "Secure Score, full production estate", figure: "20% to 76%" },
  ],
  portrait: {
    src: "/portrait-hero.png",
    alt: "Shahrouz Mohaghegh, three-quarter turn, in a daylit office.",
    width: 1311,
    height: 1200,
  },
  explore: { label: "Explore selected work", href: "/experience" },
} as const;
