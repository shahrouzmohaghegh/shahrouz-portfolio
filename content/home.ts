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
  // FR-5 as amended 2026-10-11: quality first, then speed. Each label carries
  // its figure's scope (one caps line from 768px, may wrap below). The metric's
  // name, Fault Feedback Ratio, appears only where it is defined: the Quality
  // band caption and the CS-1 case study page, never on a card or above the fold.
  figurePair: [
    { label: "Bad fixes, Vietnam team, 26 of the 38", figure: "Over 1 per fix to under 1 in 5" },
    { label: "Cycle time, AI-assisted pilot projects", figure: "30 to 40% faster" },
  ],
  portrait: {
    src: "/portrait-hero.png",
    alt: "Shahrouz Mohaghegh, three-quarter turn, in a daylit office.",
    width: 1311,
    height: 1200,
  },
  explore: { label: "Explore selected work", href: "/experience" },
  // The two evidence bands below the hero (Story 2.5), in order. Each is one
  // caps tag, one figure and one caption, nothing else. Quality is the only
  // band repeating an above-fold figure, deliberately: its caption names and
  // defines the metric the pair states in plain words. The Secure Score
  // appears nowhere else on Home.
  bands: [
    {
      tone: "deep",
      tag: "Quality",
      figure: "Over 1 per fix to under 1 in 5",
      caption:
        "Fault Feedback Ratio: every reopened bug and every new issue linked back to it, per bug fixed, on the 26-person Vietnam team, part of the 38-person function.",
    },
    {
      tone: "paper",
      tag: "Security posture",
      figure: "20% to 76%",
      caption:
        "Microsoft Defender for Cloud Secure Score across the full production Azure subscription, reported to the Digital Governance Board.",
    },
  ],
} as const;
