import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { SectionRail } from "@/components/islands/section-rail";
import { SiteFrame } from "@/components/site-frame";
import { caseStudyPage } from "@/content/case-study-page";
import {
  CAPABILITY_NAME,
  CASE_STUDY_SECTIONS,
  caseStudyBody,
  nextCaseStudy,
  writtenCaseStudyItems,
} from "@/lib/evidence";
import styles from "./case-study.module.css";

type Props = { params: Promise<{ slug: string }> };

// One page per written case study, generated at build. A case study whose
// MDX is still empty gets no page. proxy.ts answers it, like any unknown
// slug, with the static app/case-study-not-available page and a 404, before
// this route is reached, because Next.js 16.3.8 renders a segment
// not-found.tsx only on the client. notFound() below stays as the fallback
// and serves this segment's not-found.tsx. dynamicParams stays at its
// default: set to false, Next.js answers with the root not-found page.
export function generateStaticParams(): Array<{ slug: string }> {
  return writtenCaseStudyItems().map(({ slug }) => ({ slug }));
}

function writtenItem(slug: string) {
  return writtenCaseStudyItems().find((item) => item.slug === slug);
}

// The title is the bare item title; the root template adds the site name once.
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const item = writtenItem((await params).slug);
  if (item === undefined) notFound();
  return { title: item.title, description: item.summary };
}

// The case-study detail (Story 3.2): the header from the Evidence Item, then
// the SectionRail island beside the body (the five sections from the slug's
// MDX), then the link to the next written case study, wrapping to the first.
// Story 3.3 writes the prose and the content components it uses.
export default async function CaseStudyPage({ params }: Props) {
  const { slug } = await params;
  const written = writtenCaseStudyItems();
  const item = written.find((each) => each.slug === slug);
  if (item === undefined) notFound();
  const Body = await caseStudyBody(slug);
  const next = nextCaseStudy(written, slug);

  return (
    <SiteFrame current="/experience">
      <header className={styles.head}>
        {/* "Case study" sits before the list, so the list holds the capabilities only. */}
        <div className={styles.eyebrows}>
          <p className={styles.eyebrow}>{caseStudyPage.eyebrow}</p>
          <ul className={styles.capabilities}>
            {item.capabilities.map((capability) => (
              <li key={capability} className={styles.eyebrow}>
                {CAPABILITY_NAME[capability]}
              </li>
            ))}
          </ul>
        </div>
        <h1 className={styles.title}>{item.title}</h1>
        <p className={styles.dek}>{item.summary}</p>
      </header>
      <div className={styles.grid}>
        <SectionRail
          sections={CASE_STUDY_SECTIONS.map(({ id, label }) => ({ id, label }))}
          label={caseStudyPage.railLabel}
          ariaLabel={caseStudyPage.railAriaLabel}
        />
        <div className={styles.body}>
          <Body />
        </div>
      </div>
      {next !== undefined && (
        <p className={styles.next}>
          <Link href={next.href} className={styles.nextLink}>
            {`${caseStudyPage.nextLabel}: ${next.title}`}
          </Link>
        </p>
      )}
    </SiteFrame>
  );
}
