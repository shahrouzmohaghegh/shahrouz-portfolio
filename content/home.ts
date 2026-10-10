// Home's own copy: the hero (Story 2.3) and its figure pair (Story 2.4). His
// name and the availability line come from content/site.ts, the source the
// header and footer share. It lives under content/ so the content review box
// gates every word of it. Not evidence: AD-6 governs Case Studies and
// Projects only, so components may import this file directly.

export const home = {
  // The meta description for /: what search results and link previews show.
  description:
    "Engineering leader in regulated industries: a 38-person function, a Digital Governance Board seat reporting to the CEO, and twenty years across banking, payments and healthcare.",
  // FR-4: one statement at every width, 40 to 45 words, leadership scope first.
  statement:
    "Engineering leader in regulated industries, most recently running a 38-person function through six people-managers, with a standing seat on the Digital Governance Board, reporting to the CEO. Twenty years across banking, payments and healthcare, hands-on throughout, with AI-native delivery measured rather than assumed.",
  // Rendered from 768px only; it does not render at 375px.
  kicker: "Leadership · Governance · Hands-on",
  // UX-DR27: each label carries the figure's scope (one caps line from 768px, may wrap below).
  figurePair: [
    { label: "Bug reopen rate, Vietnam team, 26 of the 38", figure: "above 100% to below 20%" },
    { label: "Cloud Secure Score, full production subscription", figure: "20% to 76%" },
  ],
  portrait: {
    src: "/portrait-hero.png",
    alt: "Shahrouz Mohaghegh, three-quarter turn, in a daylit office.",
    width: 1311,
    height: 1200,
  },
  explore: { label: "Explore selected work", href: "/experience" },
} as const;
