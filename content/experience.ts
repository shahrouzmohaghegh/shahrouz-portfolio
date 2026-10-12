// The /experience listing's own copy (Story 3.1): its h1, its meta
// description, the one intro line under it and the card CTA. The cards come from lib/evidence, never from
// here. It lives under content/ so the content review box gates every word
// of it. Not evidence: AD-6 governs Case Studies and Projects only, so the
// route may import this file directly. The intro promises no filter: Epic 4
// adds that, and the link to /projects, when they exist.

export const experience = {
  heading: "Experience",
  // The meta description for /experience: what search results and link previews show.
  description:
    "Case studies in engineering leadership: an offshore delivery turnaround, AI-native engineering measured across pilot projects, and a standing seat on the Digital Governance Board.",
  intro: "Each case study runs Context, Decisions, Actions, Outcome and Lessons.",
  cta: "Read the case study",
} as const;
