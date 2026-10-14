// Which requests proxy.ts rewrites to a detail route's not-found page
// (Story 3.2, generalised to projects in Story 3.5; AD-23 note of
// 2026-10-12). Next.js 16.3.8 sends a segment not-found.tsx as an empty
// document whose content only the client renders, so it is blank with
// JavaScript off. Instead, every /experience/<slug> that is not a written
// case study, and every /projects/<slug> that is not a written project, is
// rewritten, with status 404, to its kind's static page, whose full HTML
// renders without script. Each page's own URL is rewritten to itself with a
// 404 too, so it never answers 200.
//
// It reads only the committed written lists, never lib/evidence.ts, so the
// proxy bundle carries no MDX and touches no file.

import { writtenCaseStudySlugs } from "@/content/case-studies";
import { writtenProjectSlugs } from "@/content/projects";
import { EVIDENCE_ROUTE, type EvidenceKind } from "@/lib/evidence-types";

// Each kind's static not-found page.
export const NOT_FOUND_PATH = {
  "case-study": "/case-study-not-available",
  project: "/project-not-available",
} as const satisfies Record<EvidenceKind, string>;

export const CASE_STUDY_NOT_FOUND_PATH = NOT_FOUND_PATH["case-study"];
export const PROJECT_NOT_FOUND_PATH = NOT_FOUND_PATH.project;

export type WrittenLists = Readonly<Record<EvidenceKind, readonly string[]>>;

const WRITTEN: WrittenLists = { "case-study": writtenCaseStudySlugs, project: writtenProjectSlugs };

const KINDS = Object.keys(EVIDENCE_ROUTE) as EvidenceKind[];

// One /<route>/<slug> pattern per kind, a trailing slash allowed.
const DETAIL_PATH = Object.fromEntries(KINDS.map((kind) => [kind, new RegExp(`^${EVIDENCE_ROUTE[kind]}/([^/]+)/?$`)])) as Record<
  EvidenceKind,
  RegExp
>;

// The path to rewrite to with a 404, or null to let the request through.
export function notFoundRewrite(pathname: string, written: WrittenLists = WRITTEN): string | null {
  for (const kind of KINDS) {
    const target = NOT_FOUND_PATH[kind];
    if (pathname === target) return target;
    const match = DETAIL_PATH[kind].exec(pathname);
    if (match === null) continue;
    let slug: string;
    try {
      slug = decodeURIComponent(match[1]);
    } catch {
      return target;
    }
    return written[kind].includes(slug) ? null : target;
  }
  return null;
}
