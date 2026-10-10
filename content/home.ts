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
  // FR-5 as amended 2026-10-11 (C): people first, then speed. Each row reads
  // as a phrase, the number in bold then what it measures, with its scope on
  // the line beneath (FR-34). No caps label. The Fault Feedback Ratio and bad
  // fixes stay off the first screen: the ratio lives on the CS-1 page.
  figurePair: [
    { figure: "About 35%", words: "of engineers grown into senior or leadership roles", scope: "across the 38-person function" },
    { figure: "30 to 40%", words: "faster cycle time", scope: "across AI-assisted pilot projects" },
  ],
  portrait: {
    src: "/portrait-hero.png",
    alt: "Shahrouz Mohaghegh, three-quarter turn, in a daylit office.",
    width: 1311,
    height: 1200,
  },
  explore: { label: "Explore selected work", href: "/experience" },
  // The two evidence bands below the hero (Story 2.5), in order. Each is one
  // caps tag, one figure and one caption, nothing else, and neither repeats
  // the figure pair. Each figure carries its noun, so it reads before the
  // caption. The Fault Feedback Ratio stays on the CS-1 page.
  bands: [
    {
      tone: "deep",
      tag: "Cloud delivery",
      figure: "8 weeks",
      caption:
        "Reporting service moved from the on-premise data centre to Azure, with no disruption to the 3,000 pharmacies and 200+ aged care homes it serves.",
    },
    {
      tone: "paper",
      tag: "Security posture",
      figure: "Secure Score from 20% to 76%",
      caption:
        "Microsoft Defender for Cloud Secure Score across the full production Azure subscription, reported to the Digital Governance Board.",
    },
  ],
} as const;
