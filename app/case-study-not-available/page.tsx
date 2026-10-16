import type { Metadata } from "next";

import { DetailNotFound } from "@/components/detail-not-found";
import { SiteFrame } from "@/components/site-frame";
import { caseStudyPage } from "@/content/case-study-page";

export const metadata: Metadata = { title: caseStudyPage.notFound.title, description: caseStudyPage.notFound.body, robots: { index: false } };

// The case-study not-found page as static HTML (AD-23 note of 2026-10-12).
// proxy.ts rewrites every unwritten or unknown /experience/<slug>, and this
// URL itself, here with status 404, because Next.js 16.3.8 renders a
// segment not-found.tsx only on the client. Same treatment and words as
// app/experience/[slug]/not-found.tsx, which stays as the fallback for a
// direct notFound().
export default function CaseStudyNotAvailable() {
  const { heading, body, links } = caseStudyPage.notFound;
  return (
    <SiteFrame current={null}>
      <DetailNotFound heading={heading} body={body} links={links} />
    </SiteFrame>
  );
}
