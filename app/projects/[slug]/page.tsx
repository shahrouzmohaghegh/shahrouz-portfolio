import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { SectionRail } from "@/components/islands/section-rail";
import { RepoCta } from "@/components/repo-cta";
import { SiteFrame } from "@/components/site-frame";
import { projectPage } from "@/content/project-page";
import { CAPABILITY_NAME, PROJECT_SECTION_GROUPS, evidenceBody, nextWrittenItem, writtenItems } from "@/lib/evidence";
// The detail treatment is the case-study one, shared rather than copied.
import styles from "../../experience/[slug]/case-study.module.css";

type Props = { params: Promise<{ slug: string }> };

// One page per written project (writtenProjectSlugs), generated at build.
// Any other slug is answered by proxy.ts, with the static
// app/project-not-available page and a 404, before this route is reached, because Next.js 16.3.8 renders a
// segment not-found.tsx only on the client. notFound() below stays as the
// fallback and serves this segment's not-found.tsx. dynamicParams stays at
// its default: set to false, Next.js answers with the root not-found page.
export function generateStaticParams(): Array<{ slug: string }> {
  return writtenItems("project").map(({ slug }) => ({ slug }));
}

function writtenItem(slug: string) {
  return writtenItems("project").find((item) => item.slug === slug);
}

// The title is the bare item title; the root template adds the site name once.
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const item = writtenItem((await params).slug);
  if (item === undefined) notFound();
  return { title: item.title, description: item.summary };
}

// Groups of rail items, as plain data for the island.
const RAIL_GROUPS = PROJECT_SECTION_GROUPS.map((group) => ({
  label: group.label,
  sections: group.sections.map(({ id, label }) => ({ id, label })),
}));

// The project detail (Story 3.5): the header from the Evidence Item, then
// the repository call to action when the project has a repository, then
// the SectionRail island, its eight sections under three group headers and
// the repository repeated at its foot, beside the body (the eight sections
// from the slug's MDX), then the link to the next written project, wrapping
// to the first.
export default async function ProjectPage({ params }: Props) {
  const { slug } = await params;
  const written = writtenItems("project");
  const item = written.find((each) => each.slug === slug);
  if (item === undefined) notFound();
  const Body = await evidenceBody("project", slug);
  const next = nextWrittenItem(written, slug);
  const { kicker, title } = projectPage.repository;

  return (
    <SiteFrame current="/projects">
      <header className={styles.head}>
        {/* "Project" sits before the list, so the list holds the capabilities only. */}
        <div className={styles.eyebrows}>
          <p className={styles.eyebrow}>{projectPage.eyebrow}</p>
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
        {item.repository !== undefined && <RepoCta href={item.repository} kicker={kicker} title={title} variant="panel" />}
      </header>
      <div className={styles.grid}>
        <SectionRail groups={RAIL_GROUPS} label={projectPage.railLabel} ariaLabel={projectPage.railAriaLabel}>
          {item.repository !== undefined && <RepoCta href={item.repository} kicker={kicker} title={title} variant="rail" />}
        </SectionRail>
        <div className={styles.body}>
          <Body />
        </div>
      </div>
      {next !== undefined && (
        <p className={styles.next}>
          <Link href={next.href} className={styles.nextLink}>
            {`${projectPage.nextLabel}: ${next.title}`}
          </Link>
        </p>
      )}
    </SiteFrame>
  );
}
