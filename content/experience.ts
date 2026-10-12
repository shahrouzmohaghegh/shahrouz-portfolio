// The /experience listing's own copy (Story 3.1): its h1, the one intro line
// under it and the card CTA. The cards come from lib/evidence, never from
// here. It lives under content/ so the content review box gates every word
// of it. Not evidence: AD-6 governs Case Studies and Projects only, so the
// route may import this file directly. The intro promises no filter: Epic 4
// adds that, and the link to /projects, when they exist.

export const experience = {
  heading: "Experience",
  intro: "Each case study runs Context, Decisions, Actions, Outcome and Lessons.",
  cta: "Read the case study",
} as const;
