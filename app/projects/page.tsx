import type { Metadata } from "next";

import { SiteFrame } from "@/components/site-frame";
import { listingTitle } from "@/lib/evidence";
import shell from "../shell.module.css";

export const metadata: Metadata = {
  title: listingTitle("project"),
  // Keeps this empty shell out of search results; goes when the route gets its content.
  robots: { index: false, follow: false },
};

export default function ProjectsPage() {
  return (
    <SiteFrame current="/projects">
      <div className={shell.shell}>
        <h1 className={shell.title}>Projects</h1>
      </div>
    </SiteFrame>
  );
}
