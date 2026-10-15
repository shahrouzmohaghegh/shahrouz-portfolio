// Contact's own copy (Story 3.8): the hero's heading and line, the sentence
// under each route, the statement that there is no CV, and the studio
// portrait. The address, the LinkedIn URL and the availability line come
// from content/site.ts, the source the footer shares. It lives under
// content/ so the content review box gates every word of it. Not evidence:
// AD-6 governs Case Studies and Projects only, so components may import this
// file directly. No reply-time promise: nothing in the sources supports one.

export const contact = {
  // The meta description for /contact: what search results and link previews show.
  description:
    "Reach Shahrouz Mohaghegh by email or on LinkedIn. There is no CV on the site: ask by email for the version written for your role.",
  heading: "Two ways to reach me.",
  lede: "Both go to me directly.",
  // Email first, then LinkedIn, each with the one sentence on what it suits.
  email: {
    label: "Email",
    when: "Best for a specific role, a question about something on this site, or a CV written for the job you are hiring for.",
  },
  linkedin: {
    label: "LinkedIn",
    text: "linkedin.com/in/shahrouz-mohaghegh",
    when: "Best if you want the full history before a conversation.",
  },
  noCv: {
    heading: "There is no CV on this site, and that is deliberate.",
    body: "Every CV I send is written for one job description. Ask by email and I will send the version written for your role.",
  },
  // The black studio frame (UX-DR42 interim): rendered inside a fixed plate,
  // never above its natural 1311 x 1200.
  portrait: {
    src: "/portrait-studio.png",
    alt: "Shahrouz Mohaghegh, studio portrait on a black ground.",
    width: 1311,
    height: 1200,
  },
} as const;
