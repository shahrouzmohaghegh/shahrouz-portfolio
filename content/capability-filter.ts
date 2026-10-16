// The capability filter's own words on /experience and /projects
// (EXPERIENCE.md, Capability Filter Contract): the visible label that names
// the chip group, the hidden text a selected chip carries, and the link in
// the empty state back to the unfiltered listing. The chips' short labels,
// the state line, the title and the cross-listing sentence are built in
// lib/evidence.ts (AD-13); each listing's empty-state prose lives with its
// own copy. It lives under content/ so the content review box gates every
// word of it.

export const capabilityFilter = {
  groupLabel: "Filter by capability",
  // Read after a selected chip's label; kept although aria-current="true"
  // is set too, because support for that on a link varies.
  selectedHint: ", selected",
  showAll: "Show all",
} as const;
