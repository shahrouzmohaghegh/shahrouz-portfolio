// Person structured data (Story 5.6), emitted once, by the root layout.
// Every word comes from content/site.ts, under the content review box.

import { site } from "@/content/site";

export const personData = {
  "@context": "https://schema.org",
  "@type": "Person",
  name: site.name,
  url: site.url,
  jobTitle: site.person.jobTitle,
  sameAs: [site.linkedin.href, site.person.github],
} as const;

// JSON inside a <script> must never be able to close it, so every < is
// escaped.
export const personJson = (): string => JSON.stringify(personData).replace(/</g, "\\u003c");
