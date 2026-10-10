import { HomeHero } from "@/components/home-hero";
import { SiteFrame } from "@/components/site-frame";

export default function Home() {
  return (
    <SiteFrame current="/">
      <HomeHero />
    </SiteFrame>
  );
}
