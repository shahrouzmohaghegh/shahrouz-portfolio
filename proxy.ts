import { NextResponse, type NextRequest } from "next/server";

import { caseStudyRewrite } from "@/lib/not-found-rewrite";

// The Next.js 16 proxy (formerly middleware). Its one job: answer an
// unwritten or unknown case study with the case-study not-found page and a
// real 404, as full HTML (see lib/not-found-rewrite.ts for why).
export function proxy(request: NextRequest): NextResponse {
  const target = caseStudyRewrite(request.nextUrl.pathname);
  if (target === null) return NextResponse.next();
  return NextResponse.rewrite(new URL(target, request.url), { status: 404 });
}

// Static strings only: Next.js parses the matcher at build. The second is
// CASE_STUDY_NOT_FOUND_PATH, and lib/not-found-rewrite.test.ts pins it.
export const config = {
  matcher: ["/experience/:slug", "/case-study-not-available"],
};
