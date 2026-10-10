import type { Metadata } from "next";

import { SiteFrame } from "@/components/site-frame";
import shell from "../shell.module.css";

export const metadata: Metadata = { title: "Experience" };

export default function ExperiencePage() {
  return (
    <SiteFrame current="/experience">
      <div className={shell.shell}>
        <h1 className={shell.title}>Experience</h1>
      </div>
    </SiteFrame>
  );
}
