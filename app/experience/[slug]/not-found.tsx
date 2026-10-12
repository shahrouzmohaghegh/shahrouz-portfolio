import type { Metadata } from "next";

import { DetailNotFound } from "@/components/detail-not-found";
import { SiteFrame } from "@/components/site-frame";
import { caseStudyPage } from "@/content/case-study-page";

export const metadata: Metadata = { title: caseStudyPage.notFound.title };

// The case-study not-found page (AD-23): an unwritten or unknown slug under
// /experience lands here with a 404, not on the catch-all app/not-found.tsx.
// The frame marks no nav item, like every not-found page.
export default function CaseStudyNotFound() {
  const { heading, body, links } = caseStudyPage.notFound;
  return (
    <SiteFrame current={null}>
      <DetailNotFound heading={heading} body={body} links={links} />
    </SiteFrame>
  );
}
