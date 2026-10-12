import type { Metadata } from "next";

import { DetailNotFound } from "@/components/detail-not-found";
import { SiteFrame } from "@/components/site-frame";
import { caseStudyPage } from "@/content/case-study-page";

export const metadata: Metadata = { title: caseStudyPage.notFound.title };

// The fallback case-study not-found page (AD-23). An unwritten or unknown
// slug under /experience is answered by proxy.ts first, which rewrites it
// with a 404 to the static app/case-study-not-available page, because
// Next.js 16.3.8 renders this file only on the client (blank with
// JavaScript off). This page serves only a notFound() that still reaches
// the route. The frame marks no nav item, like every not-found page.
export default function CaseStudyNotFound() {
  const { heading, body, links } = caseStudyPage.notFound;
  return (
    <SiteFrame current={null}>
      <DetailNotFound heading={heading} body={body} links={links} />
    </SiteFrame>
  );
}
