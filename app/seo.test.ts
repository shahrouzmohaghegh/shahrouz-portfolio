// Story 5.6: the site is findable, and a shared link previews correctly.
// The sitemap, robots.txt, the root layout's preview defaults, the Person
// structured data and the preview image's colours. The served files are
// checked again on the running build by scripts/check-content.mts.

import { existsSync, readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

import { site } from "@/content/site";
import { writtenItems } from "@/lib/evidence";
import { personData, personJson } from "@/lib/structured-data";
import { tokenColour } from "@/lib/token-colour";
import { canonicalRoutes } from "@/scripts/check-content.mts";
import { metadata } from "./layout";
import robots from "./robots";
import sitemap from "./sitemap";

const EM_DASH = String.fromCharCode(0x2014);

describe("the sitemap", () => {
  const urls = sitemap().map((entry) => entry.url);

  test("lists every canonical route, Home, both listings, Contact and every written detail page, on the live domain", () => {
    expect(urls).toEqual(canonicalRoutes().map((path) => `${site.url}${path}`));
    for (const item of [...writtenItems("case-study"), ...writtenItems("project")]) expect(urls).toContain(`${site.url}${item.href}`);
  });

  test("never lists a filtered or query URL", () => {
    for (const url of urls) expect(new URL(url).search, url).toBe("");
  });
});

describe("robots.txt", () => {
  test("allows everything and names the sitemap", () => {
    expect(robots()).toEqual({ rules: { userAgent: "*", allow: "/" }, sitemap: `${site.url}/sitemap.xml` });
  });
});

describe("the root layout's preview defaults", () => {
  test("Open Graph and Twitter are set once, with no title or description of their own, so each route's words fill them", () => {
    expect(String(metadata.metadataBase)).toBe(`${site.url}/`);
    expect(metadata.openGraph).toEqual({ type: "website", siteName: site.name, locale: "en_AU" });
    expect(metadata.twitter).toEqual({ card: "summary_large_image" });
  });

  test("the preview image is generated, not a photograph, and its alt carries no em dash", () => {
    expect(existsSync("app/opengraph-image.tsx")).toBe(true);
    expect(existsSync("app/opengraph-image.png") || existsSync("app/opengraph-image.jpg")).toBe(false);
    const source = readFileSync("app/opengraph-image.tsx", "utf8");
    expect(source).not.toMatch(/<img|\.png|\.jpe?g|portrait/i);
    expect(site.previewAlt).not.toContain(EM_DASH);
  });

  test("the preview image takes its colours from tokens.css", () => {
    expect(tokenColour("paper")).toMatch(/^#[0-9A-Fa-f]{6}$/);
    expect(() => tokenColour("no-such-token")).toThrow(/has no --color-no-such-token/);
  });
});

describe("Person structured data", () => {
  test("names him, the site, his role band and his public profiles", () => {
    expect(personData).toEqual({
      "@context": "https://schema.org",
      "@type": "Person",
      name: "Shahrouz Mohaghegh",
      url: site.url,
      jobTitle: "Engineering leader",
      sameAs: [site.linkedin.href, "https://github.com/shahrouzmohaghegh"],
    });
  });

  test("is JSON that cannot close its script tag, and carries no em dash", () => {
    expect(JSON.parse(personJson())).toEqual(personData);
    expect(personJson()).not.toContain("<");
    expect(personJson()).not.toContain(EM_DASH);
  });

  test("is emitted once, by the root layout", () => {
    expect(readFileSync("app/layout.tsx", "utf8").match(/application\/ld\+json/g)).toHaveLength(1);
  });
});
