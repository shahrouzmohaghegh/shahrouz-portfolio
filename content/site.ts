// Site-wide copy: the wordmark, the footer and the lines Home reuses (Home
// takes the name and availability from here; the positioning line renders
// in the footer only). It
// lives under content/ so the content review box gates every word of it.
// Not evidence: AD-6 governs Case Studies and Projects only, so components
// may import this file directly.

export const site = {
  name: "Shahrouz Mohaghegh",
  positioning: "Engineering leadership in regulated industries, measured by what ships and stays shipped.",
  location: "Sydney, Australia.",
  availability: "Open to conversations about the next role.",
  evidenceLabel: "Evidence",
  evidenceLinks: [
    { label: "Experience", href: "/experience" },
    { label: "Projects", href: "/projects" },
  ],
  contactLabel: "Contact",
  email: "shahrouz.mohaghegh@gmail.com",
  linkedin: { label: "LinkedIn", href: "https://www.linkedin.com/in/shahrouz-mohaghegh/" },
  cvNote: "No CV download. Ask by email and I will send the version written for the role.",
} as const;
