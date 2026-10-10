import type { Metadata } from "next";

import { SiteFrame } from "@/components/site-frame";
import shell from "../shell.module.css";

export const metadata: Metadata = {
  title: "Contact",
  // Keeps this empty shell out of search results; goes when the route gets its content.
  robots: { index: false, follow: false },
};

export default function ContactPage() {
  return (
    <SiteFrame current="/contact">
      <div className={shell.shell}>
        <h1 className={shell.title}>Contact</h1>
      </div>
    </SiteFrame>
  );
}
