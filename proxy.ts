import { NextResponse, type NextRequest } from "next/server";

import { notFoundRewrite } from "@/lib/not-found-rewrite";

// The Next.js 16 proxy (formerly middleware). Its one job: answer an
// unwritten or unknown case study or project with its kind's not-found page
// and a real 404, as full HTML (see lib/not-found-rewrite.ts for why).
export function proxy(request: NextRequest): NextResponse {
  const target = notFoundRewrite(request.nextUrl.pathname);
  if (target === null) return NextResponse.next();
  return NextResponse.rewrite(new URL(target, request.url), { status: 404 });
}

// Static strings only: Next.js parses the matcher at build. The second and
// fourth are NOT_FOUND_PATH's two pages, and lib/not-found-rewrite.test.ts
// pins them.
export const config = {
  matcher: ["/experience/:slug", "/case-study-not-available", "/projects/:slug", "/project-not-available"],
};
