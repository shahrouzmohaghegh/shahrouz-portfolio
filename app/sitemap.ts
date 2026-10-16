import type { MetadataRoute } from "next";

import { site } from "@/content/site";
import { writtenItems } from "@/lib/evidence";

// The sitemap (Story 5.6), sole owner of /sitemap.xml: every canonical,
// indexable route, which is Home, both listings unfiltered, Contact and
// every written detail page. A filtered listing is never listed: it asks
// for noindex. scripts/check-content.mts holds the served file to the same
// list (canonicalRoutes), and app/sitemap.test.ts holds the two together.
const sitemapPaths = (): string[] => [
  "/",
  "/experience",
  "/projects",
  "/contact",
  ...writtenItems("case-study").map((item) => item.href),
  ...writtenItems("project").map((item) => item.href),
];

export default function sitemap(): MetadataRoute.Sitemap {
  return sitemapPaths().map((path) => ({ url: path === "/" ? `${site.url}/` : `${site.url}${path}` }));
}
