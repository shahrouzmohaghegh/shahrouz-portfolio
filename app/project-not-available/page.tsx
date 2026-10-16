import type { Metadata } from "next";

import { DetailNotFound } from "@/components/detail-not-found";
import { SiteFrame } from "@/components/site-frame";
import { projectPage } from "@/content/project-page";

export const metadata: Metadata = { title: projectPage.notFound.title, description: projectPage.notFound.body, robots: { index: false } };

// The project not-found page as static HTML (Story 3.5, AD-23 note of
// 2026-10-12), the project twin of app/case-study-not-available. proxy.ts
// rewrites every unwritten or unknown /projects/<slug>, and this URL
// itself, here with status 404, because Next.js 16.3.8 renders a segment
// not-found.tsx only on the client. Same treatment and words as
// app/projects/[slug]/not-found.tsx, which stays as the fallback for a
// direct notFound().
export default function ProjectNotAvailable() {
  const { heading, body, links } = projectPage.notFound;
  return (
    <SiteFrame current={null}>
      <DetailNotFound heading={heading} body={body} links={links} />
    </SiteFrame>
  );
}
