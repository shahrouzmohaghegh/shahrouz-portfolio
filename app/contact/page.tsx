import type { Metadata } from "next";
import Image from "next/image";

import { EmailAddress } from "@/components/email-address";
import { SiteFrame } from "@/components/site-frame";
import { contact } from "@/content/contact";
import { site } from "@/content/site";
import styles from "./contact.module.css";

export const metadata: Metadata = { title: "Contact", description: contact.description };

// The Contact route (Story 3.8, {components.contact-hero}). The hero sits on
// the deep ground: the h1, the line under it, then exactly two routes, email
// first then LinkedIn, each a caps label, the link and one sentence on what
// it suits, then the availability line. The studio portrait sits on its
// plate beside the text from wide screens and below it otherwise; the text
// always comes first. Below the hero, on paper, the statement that there is
// no CV and why. No form, no backend, no download. Static, and it hydrates
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
        {/* The studio ground and the alt hold the composition if the image fails. */}
        <div className={styles.plate}>
          <Image
            className={styles.portrait}
            src={portrait.src}
            alt={portrait.alt}
            width={portrait.width}
            height={portrait.height}
          />
        </div>
      </section>
      <section className={styles.noCv} aria-labelledby="no-cv-heading">
        <h2 id="no-cv-heading" className={styles.noCvHeading}>
          {contact.noCv.heading}
        </h2>
        <p className={styles.noCvBody}>{contact.noCv.body}</p>
      </section>
    </SiteFrame>
  );
}
