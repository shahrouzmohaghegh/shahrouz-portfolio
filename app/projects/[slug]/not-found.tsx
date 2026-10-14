import type { Metadata } from "next";

import { DetailNotFound } from "@/components/detail-not-found";
import { SiteFrame } from "@/components/site-frame";
import { projectPage } from "@/content/project-page";

export const metadata: Metadata = { title: projectPage.notFound.title };

// The fallback project not-found page (AD-23). An unwritten or unknown slug
// under /projects is answered by proxy.ts first, which rewrites it with a
// 404 to the static app/project-not-available page, because Next.js 16.3.8
// renders this file only on the client (blank with JavaScript off). This
// page serves only a notFound() that still reaches the route. The frame
// marks no nav item, like every not-found page.
export default function ProjectNotFound() {
  const { heading, body, links } = projectPage.notFound;
  return (
    <SiteFrame current={null}>
      <DetailNotFound heading={heading} body={body} links={links} />
    </SiteFrame>
  );
}
