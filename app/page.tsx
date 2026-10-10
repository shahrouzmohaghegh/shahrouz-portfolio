import type { Metadata } from "next";

import { HomeHero } from "@/components/home-hero";
import { SiteFrame } from "@/components/site-frame";
import { home } from "@/content/home";

// The title stays the root default, "Shahrouz Mohaghegh".
export const metadata: Metadata = { description: home.description };

export default function Home() {
  return (
    <SiteFrame current="/">
      <HomeHero />
    </SiteFrame>
  );
}
