// Which requests proxy.ts rewrites to the case-study not-found page
// (Story 3.2, AD-23 note of 2026-10-12). Next.js 16.3.8 sends a segment
// not-found.tsx as an empty document whose content only the client renders,
// so it is blank with JavaScript off. Instead, every /experience/<slug> that
// is not a written case study is rewritten, with status 404, to a static
// page whose full HTML renders without script. That page's own URL is
// rewritten to itself with a 404 too, so it never answers 200.
//
// It reads only the committed written list, never lib/evidence.ts, so the
// proxy bundle carries no MDX and touches no file.

import { writtenCaseStudySlugs } from "@/content/case-studies";

export const CASE_STUDY_NOT_FOUND_PATH = "/case-study-not-available";

const CASE_STUDY_PATH = /^\/experience\/([^/]+)\/?$/;

// The path to rewrite to with a 404, or null to let the request through.
export function caseStudyRewrite(pathname: string, written: readonly string[] = writtenCaseStudySlugs): string | null {
  if (pathname === CASE_STUDY_NOT_FOUND_PATH) return CASE_STUDY_NOT_FOUND_PATH;
  const match = CASE_STUDY_PATH.exec(pathname);
  if (match === null) return null;
  let slug: string;
  try {
    slug = decodeURIComponent(match[1]);
  } catch {
    return CASE_STUDY_NOT_FOUND_PATH;
  }
  return written.includes(slug) ? null : CASE_STUDY_NOT_FOUND_PATH;
}
