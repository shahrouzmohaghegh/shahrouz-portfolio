import type { Metadata } from "next";

import { EvidenceBand } from "@/components/evidence-band";
import { HomeHero } from "@/components/home-hero";
import { RevealOnScroll } from "@/components/islands/reveal-on-scroll";
import { SiteFrame } from "@/components/site-frame";
import { home } from "@/content/home";

// The title stays the root default, "Shahrouz Mohaghegh".
export const metadata: Metadata = { description: home.description };

// Home hydrates one island, RevealOnScroll, which fades in the evidence
// bands. The hero and its figure pair are never reveal targets.
export default function Home() {
  return (
    <SiteFrame current="/">
      <HomeHero />
      {home.bands.map((band) => (
        <EvidenceBand key={band.tag} {...band} />
      ))}
      <RevealOnScroll />
    </SiteFrame>
  );
}
