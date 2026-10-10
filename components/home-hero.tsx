import Image from "next/image";
import Link from "next/link";

import { home } from "@/content/home";
import { site } from "@/content/site";
import { FigurePair } from "./figure-pair";
import styles from "./home-hero.module.css";

// Home's hero (UX-DR39, Stories 2.3 and 2.4). Text first at every width: his
// name as the h1, the kicker (from 768px only), the positioning statement,
// availability and the figure pair. At 375px that stack is the whole fold, and
// the plate then the Explore link sit below it. From 768px the plate stands
// beside the text. The h1 is site.name as one text run, because the production
// watch and the UptimeRobot keyword both match it.
export function HomeHero() {
  const { portrait, explore } = home;
  return (
    <section className={styles.hero} aria-labelledby="home-name">
      <div className={styles.text}>
        <h1 id="home-name" className={styles.name}>
          {site.name}
        </h1>
        <p className={styles.kicker}>{home.kicker}</p>
        <p className={styles.statement}>{home.statement}</p>
        <p className={styles.availability}>{site.availability}</p>
        <FigurePair rows={home.figurePair} />
      </div>
      {/* The plate ground and the alt hold the composition if the image fails. */}
      <div className={styles.plate}>
        <Image
          className={styles.portrait}
          src={portrait.src}
          alt={portrait.alt}
          width={portrait.width}
          height={portrait.height}
          loading="eager"
        />
      </div>
      <p className={styles.explore}>
        <Link href={explore.href} className={styles.exploreLink}>
          {explore.label} <span aria-hidden="true">&#8594;</span>
        </Link>
      </p>
    </section>
  );
}
