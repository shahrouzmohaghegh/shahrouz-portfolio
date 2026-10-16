// Tests for check-lighthouse.mts's pure rules: the median, the thresholds,
// the portrait judgements (AD-12) and the dependency weight (NFR-7). Run
// with: npm run test:scripts. The Lighthouse runs themselves are the gate
// step; they need a served build and Chromium.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";

import {
  CATEGORIES,
  HERO_FETCH_PRIORITY,
  HOME_MOBILE_LCP_MS,
  MIN_SCORE,
  PAGES,
  PORTRAITS,
  PORTRAIT_SIZE,
  PROFILES,
  RUNS,
  clientModuleProblems,
  forbiddenPackages,
  median,
  medianOf,
  pngSize,
  portraitProblems,
  projectClientModules,
  thresholdProblems,
  type PortraitReading,
  type Run,
} from "./check-lighthouse.mts";

const all = (score: number) => Object.fromEntries(CATEGORIES.map((c) => [c, score])) as Run["scores"];

describe("what is measured", () => {
  test("six pages, both profiles, three runs, the thresholds as decided", () => {
    assert.deepEqual(PAGES, ["/", "/experience", "/projects", "/experience/offshore-delivery-turnaround", "/projects/career-application-system", "/contact"]);
    assert.deepEqual(PROFILES, ["mobile", "desktop"]);
    assert.equal(RUNS, 3);
    assert.equal(MIN_SCORE, 90);
    assert.equal(HOME_MOBILE_LCP_MS, 2000);
    assert.deepEqual(CATEGORIES, ["performance", "accessibility", "best-practices", "seo"]);
  });
});

describe("the median", () => {
  test("of an odd and an even count", () => {
    assert.equal(median([91, 70, 99]), 91);
    assert.equal(median([1, 2, 3, 4]), 2.5);
    assert.ok(Number.isNaN(median([])));
    // One unscored run fails the page rather than hiding behind the others.
    assert.ok(Number.isNaN(median([100, Number.NaN, 100])));
  });

  test("is taken per score, so one noisy run neither passes nor fails", () => {
    const runs: Run[] = [
      { scores: { ...all(100), performance: 60 }, lcpMs: 3000 },
      { scores: all(95), lcpMs: 1500 },
      { scores: all(92), lcpMs: 1600 },
    ];
    const measured = medianOf("/", "mobile", runs);
    assert.equal(measured.scores.performance, 92);
    assert.equal(measured.lcpMs, 1600);
    assert.deepEqual(thresholdProblems(measured), []);
  });
});

describe("the thresholds", () => {
  test("a category below 90 fails, naming page, profile, category and score", () => {
    assert.deepEqual(thresholdProblems({ page: "/contact", profile: "desktop", scores: { ...all(100), seo: 89 }, lcpMs: 500 }), ["/contact (desktop): seo 89, below 90"]);
  });

  test("90 passes; an unscored category fails", () => {
    assert.deepEqual(thresholdProblems({ page: "/contact", profile: "mobile", scores: all(90), lcpMs: 5000 }), []);
    assert.equal(thresholdProblems({ page: "/x", profile: "mobile", scores: { ...all(100), performance: Number.NaN }, lcpMs: 1 }).length, 1);
  });

  test("Home's mobile LCP must be under 2.0s; desktop and other pages are not held to it", () => {
    assert.deepEqual(thresholdProblems({ page: "/", profile: "mobile", scores: all(100), lcpMs: 2000 }), ["/ (mobile): Largest Contentful Paint 2.00s, not under 2s"]);
    assert.deepEqual(thresholdProblems({ page: "/", profile: "mobile", scores: all(100), lcpMs: 1999 }), []);
    assert.deepEqual(thresholdProblems({ page: "/", profile: "desktop", scores: all(100), lcpMs: 2500 }), []);
  });
});

describe("portraits (AD-12)", () => {
  const ok: PortraitReading = { count: 1, loading: "eager", fetchPriority: null, highPriorityPreloads: 0, naturalWidth: 1311, naturalHeight: 1200, renderedWidth: 600 };

  test("one eager hero image, no priority, at its natural size, passes", () => {
    assert.deepEqual(portraitProblems("/", 375, true, ok), []);
    assert.equal(HERO_FETCH_PRIORITY, false);
  });

  test("a second image, lazy hero, fetchpriority high, a priority preload, upscaling each fail", () => {
    assert.match(portraitProblems("/", 375, true, { ...ok, count: 2 })[0], /2 portrait <img> elements/);
    assert.match(portraitProblems("/", 375, true, { ...ok, loading: "lazy" })[0], /loading="lazy", expected eager/);
    assert.match(portraitProblems("/", 375, true, { ...ok, fetchPriority: "high" })[0], /fetchpriority="high"/);
    assert.deepEqual(portraitProblems("/", 375, true, { ...ok, fetchPriority: "high" }, true), []);
    assert.match(portraitProblems("/contact", 375, false, { ...ok, highPriorityPreloads: 1 })[0], /high-priority image preload/);
    assert.match(portraitProblems("/", 1440, true, { ...ok, naturalWidth: 1920, naturalHeight: 1757 })[0], /upscaled past 1311 x 1200/);
    assert.match(portraitProblems("/", 1440, true, { ...ok, renderedWidth: 1400 })[0], /drawn 1400px wide from 1311/);
  });

  test("a lazy Contact portrait passes: only the hero must be eager", () => {
    assert.deepEqual(portraitProblems("/contact", 375, false, { ...ok, loading: "lazy" }), []);
  });

  test("both committed portrait files are their natural 1311 x 1200", () => {
    for (const portrait of PORTRAITS) assert.deepEqual(pngSize(readFileSync(portrait.file)), PORTRAIT_SIZE, portrait.file);
    assert.equal(pngSize(new Uint8Array([1, 2, 3])), null);
  });
});

describe("dependency weight (NFR-7)", () => {
  test("component libraries, CSS frameworks and animation libraries are named; the real package.json has none", () => {
    const pkg = JSON.stringify({ dependencies: { next: "1", "@mui/material": "1", "framer-motion": "1" }, devDependencies: { tailwindcss: "1", "motion-utils-not": "1" } });
    assert.deepEqual(forbiddenPackages(pkg), ["@mui/material", "framer-motion", "tailwindcss"]);
    assert.deepEqual(forbiddenPackages(readFileSync("package.json", "utf8")), []);
  });

  const manifest = (keys: string[]) =>
    `globalThis.__RSC_MANIFEST = globalThis.__RSC_MANIFEST || {};\nglobalThis.__RSC_MANIFEST["/page"] = ${JSON.stringify({
      clientModules: Object.fromEntries(keys.map((key) => [key, { id: 1 }])),
      entryCSSFiles: { "[project]/app/layout": [] },
    })};`;

  test("projectClientModules reads clientModules only, without Next.js's own", () => {
    const modules = projectClientModules(
      manifest(["[project]/node_modules/next/dist/client/app-dir/link.js", "[project]/components/islands/section-rail.tsx#SectionRail", "[project]/components/islands/section-rail.tsx"]),
    );
    assert.deepEqual(modules, ["components/islands/section-rail.tsx"]);
  });

  test("the two islands and analytics pass on a page; anything else fails; a listing may ship no island", () => {
    assert.deepEqual(clientModuleProblems("page_client-reference-manifest.js", ["components/islands/reveal-on-scroll.tsx", "node_modules/@vercel/analytics/dist/next/index.mjs"]), []);
    assert.match(clientModuleProblems("page_client-reference-manifest.js", ["components/menu.tsx"])[0], /not one of the two islands/);
    assert.match(clientModuleProblems("experience/page_client-reference-manifest.js", ["components/islands/reveal-on-scroll.tsx"])[0], /neither listing may hydrate/);
  });
});
