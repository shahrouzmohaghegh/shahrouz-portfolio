import type { MetadataRoute } from "next";

import { site } from "@/content/site";

// robots.txt (Story 5.6), sole owner of the file: every crawler may read
// everything, and the sitemap is named. Filtered listings and the not-found
// pages keep themselves out of the index with their own robots noindex.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: `${site.url}/sitemap.xml`,
  };
}
