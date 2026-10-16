import type { Metadata } from "next";
import Image from "next/image";

import { EmailAddress } from "@/components/email-address";
import { SiteFrame } from "@/components/site-frame";
import { contact } from "@/content/contact";
import { site } from "@/content/site";
import styles from "./contact.module.css";

// The plate's rendered width: --space-contact-plate-mobile-width below the
// 768px switch, --space-contact-plate-desktop-width from it
// (styles/tokens.css, styles/breakpoints.css; contact.test.tsx pins both), so
// a 1x screen fetches an image near 420px, not the full 1311px.
export const PORTRAIT_SIZES = "(max-width: 767px) 264px, 420px";

export const metadata: Metadata = { title: "Contact", description: contact.description };

// The Contact route (Story 3.8, {components.contact-hero}). The hero sits on
// the deep ground: the h1, the line under it, then exactly two routes, email
// first then LinkedIn, each a caps label, the link and one sentence on what
// it suits, then the availability line. The studio portrait sits on its
// plate beside the text from wide screens and below it otherwise; the text
// always comes first in the source: on wide screens the plate is drawn to the
// left of the text (row-reverse), so visual and DOM order differ on purpose,
// which is safe because the plate holds nothing focusable. Below the hero, on
// paper, the statement that there is no CV and why, with its own mailto:. No form, no backend, no download. Static, and it hydrates
// no island: both links work with JavaScript off.
export default function ContactPage() {
  const { portrait } = contact;
  return (
    <SiteFrame current="/contact">
      <section className={styles.hero} aria-labelledby="contact-heading">
        <div className={styles.text}>
          <h1 id="contact-heading" className={styles.title}>
            {contact.heading}
          </h1>
          <p className={styles.lede}>{contact.lede}</p>
          <ul className={styles.routes}>
            <li className={styles.route}>
              <p className={styles.label}>{contact.email.label}</p>
              <a href={`mailto:${site.email}`} className={styles.routeLink}>
                <EmailAddress address={site.email} />
              </a>
              <p className={styles.when}>{contact.email.when}</p>
            </li>
            <li className={styles.route}>
              <p className={styles.label}>{contact.linkedin.label}</p>
              <a href={site.linkedin.href} className={styles.routeLink}>
                {contact.linkedin.text}
              </a>
              <p className={styles.when}>{contact.linkedin.when}</p>
            </li>
          </ul>
          <p className={styles.availability}>{site.availability}</p>
        </div>
        {/* The studio ground and the alt hold the composition if the image fails.
            Lazy, with no priority, as on Home (AD-12): the plate is not the
            375px LCP, which is the heading above it. */}
        <div className={styles.plate}>
          <Image
            className={styles.portrait}
            src={portrait.src}
            alt={portrait.alt}
            width={portrait.width}
            height={portrait.height}
            sizes={PORTRAIT_SIZES}
          />
        </div>
      </section>
      <section className={styles.noCv} aria-labelledby="no-cv-heading">
        <h2 id="no-cv-heading" className={styles.noCvHeading}>
          {contact.noCv.heading}
        </h2>
        <p className={styles.noCvBody}>
          {contact.noCv.lead}{" "}
          <a href={`mailto:${site.email}`} className={styles.noCvLink}>
            {contact.noCv.ask}
          </a>
          {contact.noCv.rest}
        </p>
      </section>
    </SiteFrame>
  );
}
