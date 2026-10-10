import type { Metadata } from "next";

import { SiteFrame } from "@/components/site-frame";
import shell from "./shell.module.css";

export const metadata: Metadata = { title: "Page not found" };

// The catch-all for an unmatched URL (AD-23 note): the frame with no current
// item and a real 404. Epic 3's /experience/[slug] and /projects/[slug] keep
// their own not-found pages and messages.
export default function NotFound() {
  return (
    <SiteFrame current={null}>
      <div className={shell.shell}>
        <h1 className={shell.title}>Page not found</h1>
      </div>
    </SiteFrame>
  );
}
