import type { Metadata } from "next";

import { SiteFrame } from "@/components/site-frame";
import shell from "../shell.module.css";

export const metadata: Metadata = { title: "Contact" };

export default function ContactPage() {
  return (
    <SiteFrame current="/contact">
      <div className={shell.shell}>
        <h1 className={shell.title}>Contact</h1>
      </div>
    </SiteFrame>
  );
}
