import type { Metadata } from "next";

import { SiteFrame } from "@/components/site-frame";
import shell from "../shell.module.css";

export const metadata: Metadata = { title: "Projects" };

export default function ProjectsPage() {
  return (
    <SiteFrame current="/projects">
      <div className={shell.shell}>
        <h1 className={shell.title}>Projects</h1>
      </div>
    </SiteFrame>
  );
}
