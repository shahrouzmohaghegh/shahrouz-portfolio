import type { Metadata } from "next";

import { EvidenceBand } from "@/components/evidence-band";
import { HomeHero } from "@/components/home-hero";
import { RevealOnScroll } from "@/components/islands/reveal-on-scroll";
import { SelectedWork } from "@/components/selected-work";
import { SiteFrame } from "@/components/site-frame";
import { home } from "@/content/home";
import { caseStudyItems } from "@/lib/evidence";

// The title stays the root default, "Shahrouz Mohaghegh".
export const metadata: Metadata = { description: home.description };

// Home hydrates one island, RevealOnScroll, which fades in the evidence
// bands. The hero, its figure pair and Selected work are never reveal
// targets. Selected work is given the case study collection whole: Home never
// lists items itself, so adding or removing one needs no edit here.
export default function Home() {
  return (
    <SiteFrame current="/">
      <HomeHero />
      {home.bands.map((band) => (
        <EvidenceBand key={band.tag} {...band} />
      ))}
      <SelectedWork items={caseStudyItems} />
      <RevealOnScroll />
    </SiteFrame>
  );
}
