// The /experience listing's own copy (Story 3.1): its h1, its meta
// description, the one intro line under it and the card CTA. The cards come
// from lib/evidence, never from here. It lives under content/ so the content review box gates every word
// of it. Not evidence: AD-6 governs Case Studies and Projects only, so the
// route may import this file directly. `empty` is the explanation the
// empty state gives when the selected capabilities match no case study
// (at launch, Hands-On only); the cross-listing link to /projects leads it.

export const experience = {
  heading: "Experience",
  // The meta description for /experience: what search results and link previews show.
  description:
    "Case studies in engineering leadership: an offshore delivery turnaround, AI-native engineering measured across pilot projects, and a standing seat on the Digital Governance Board.",
  intro: "Work from regulated healthcare, each with the decisions behind it, what they cost, and the measured outcome.",
  cta: "Read the case study",
  empty: "The case studies tell the organisational story. Hands-on evidence is carried by the systems themselves, so it lives on Projects.",
} as const;
