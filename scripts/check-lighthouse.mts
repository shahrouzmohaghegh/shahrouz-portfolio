// The site is fast on a phone on mobile data (Story 5.4, NFR-3, AD-12,
// NFR-7). Run in the gate against `next start`, after the build:
//
//   node scripts/check-lighthouse.mts <base-url>     e.g. http://localhost:3000
//
// 1. Lighthouse. PAGES (Home, both listings, the first written case study
//    and project, and /contact) on both PROFILES: mobile (Lighthouse's default, simulated
//    throttling on a mid-range phone over slow 4G) and desktop. Each page and
//    profile runs RUNS times and the median of each score is judged, so one
//    noisy run neither passes nor fails the gate. Performance, Accessibility,
//    Best Practices and SEO must each be at least MIN_SCORE (90), and Home's
//    mobile Largest Contentful Paint under HOME_MOBILE_LCP_MS (2.0s). A miss
//    names the page, the profile, the category and the median score.
//    Chromium is the one @playwright/test installs, started with a remote
//    debugging port for Lighthouse to drive.
// 2. Portraits (AD-12), in the same browser at 375 and 1440 wide: exactly
//    one <img> per portrait on its page (no second copy shown and hidden by
//    breakpoint); the Home hero is loading="eager", never fetchpriority
//    high unless HERO_FETCH_PRIORITY records AD-12's sanctioned step, and
//    the page carries no high-priority image preload (what next/image's
//    priority emits); each portrait file is its natural 1311 x 1200, no
//    image the browser decodes is larger, and none is drawn wider than its
//    decoded pixels at 1x.
// 3. Dependency weight (NFR-7): package.json names no component library,
//    CSS framework or animation library (FORBIDDEN_PACKAGES), and the
//    built client reference manifests list no client component of this
//    project except the two islands (plus Vercel Analytics once Epic 6 adds
//    it); neither listing ships an island at all.
//
// Exit 1 on any failure.

import { readFileSync, readdirSync } from "node:fs";
import { createServer } from "node:net";
import { join } from "node:path";
import { runInNewContext } from "node:vm";

import { chromium, type Browser } from "@playwright/test";
import lighthouse from "lighthouse";
import desktopConfig from "lighthouse/core/config/desktop-config.js";

import { caseStudies, writtenCaseStudySlugs } from "../content/case-studies/index.ts";
import { projects, writtenProjectSlugs } from "../content/projects/index.ts";
import { isEntryPoint } from "./entry-point.mts";

// Home, both listings, the first written case study and project in
// collection order (so a renamed or rewritten item never leaves the run
// pointing at a page that is gone) and Contact.
const firstWritten = (items: ReadonlyArray<{ slug: string; href: string }>, written: readonly string[]): string => {
  const item = items.find((each) => written.includes(each.slug));
  if (item === undefined) throw new Error("no written item to measure");
  return item.href;
};
export const PAGES: readonly string[] = [
  "/",
  "/experience",
  "/projects",
  firstWritten(caseStudies, writtenCaseStudySlugs),
  firstWritten(projects, writtenProjectSlugs),
  "/contact",
];
export const PROFILES = ["mobile", "desktop"] as const;
export type Profile = (typeof PROFILES)[number];
export const CATEGORIES = ["performance", "accessibility", "best-practices", "seo"] as const;
export type Category = (typeof CATEGORIES)[number];
export const RUNS = 3;
export const MIN_SCORE = 90;
export const HOME_MOBILE_LCP_MS = 2000;

// AD-12's sanctioned step: false until desktop Performance misses 90 with
// LCP as the cause, and only then set with the hero's fetchPriority="high".
export const HERO_FETCH_PRIORITY = false;

export const PORTRAITS = [
  { page: "/", file: "public/portrait-hero.png", src: "portrait-hero", hero: true },
  { page: "/contact", file: "public/portrait-studio.png", src: "portrait-studio", hero: false },
] as const;
export const PORTRAIT_SIZE = { width: 1311, height: 1200 };

// Packages that would be a component library, a CSS framework or an
// animation library: exact names, and scopes ending in a slash.
export const FORBIDDEN_PACKAGES = [
  "@mui/", "@material-ui/", "@chakra-ui/", "@mantine/", "@radix-ui/", "@headlessui/", "@nextui-org/", "@heroui/", "@ark-ui/", "@emotion/", "@stitches/", "@vanilla-extract/", "@pandacss/", "@shadcn/", "@react-spring/",
  "antd", "react-bootstrap", "bootstrap", "semantic-ui-react", "primereact", "evergreen-ui", "rsuite", "flowbite", "flowbite-react", "daisyui",
  "tailwindcss", "bulma", "foundation-sites", "styled-components", "unocss", "windicss", "sass", "less",
  "framer-motion", "motion", "gsap", "animejs", "react-spring", "react-transition-group", "aos", "lottie-web", "lottie-react", "popmotion", "velocity-animate",
] as const;

export const ISLANDS = ["components/islands/reveal-on-scroll.tsx", "components/islands/section-rail.tsx"] as const;
// The analytics exemption (Epic 6): its client components may appear once added.
export const ANALYTICS_PREFIX = "node_modules/@vercel/analytics/";
export const LISTING_MANIFESTS = ["experience/page_client-reference-manifest.js", "projects/page_client-reference-manifest.js"] as const;

// ---------------------------------------------------------------- pure rules

// The median; NaN (which fails every threshold) when there are no values or
// any run went unscored, so a missing score never hides behind the others.
export function median(values: readonly number[]): number {
  if (values.length === 0 || values.some((value) => Number.isNaN(value))) return Number.NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export type Run = { scores: Record<Category, number>; lcpMs: number; benchmarkIndex?: number };
export type Measured = { page: string; profile: Profile; scores: Record<Category, number>; lcpMs: number };

// The median of each score and of LCP across a page's runs on one profile.
export function medianOf(page: string, profile: Profile, runs: readonly Run[]): Measured {
  const scores = Object.fromEntries(CATEGORIES.map((category) => [category, median(runs.map((run) => run.scores[category]))])) as Record<Category, number>;
  return { page, profile, scores, lcpMs: median(runs.map((run) => run.lcpMs)) };
}

export function thresholdProblems(measured: Measured): string[] {
  const problems: string[] = [];
  for (const category of CATEGORIES) {
    const score = measured.scores[category];
    if (!(score >= MIN_SCORE)) problems.push(`${measured.page} (${measured.profile}): ${category} ${Number.isNaN(score) ? "not scored" : score}, below ${MIN_SCORE}`);
  }
  if (measured.page === "/" && measured.profile === "mobile" && !(measured.lcpMs < HOME_MOBILE_LCP_MS)) {
    problems.push(`/ (mobile): Largest Contentful Paint ${(measured.lcpMs / 1000).toFixed(2)}s, not under ${HOME_MOBILE_LCP_MS / 1000}s`);
  }
  return problems;
}

export function forbiddenPackages(packageJsonText: string): string[] {
  const pkg = JSON.parse(packageJsonText) as Record<string, Record<string, string> | undefined>;
  const names = ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"].flatMap((group) => Object.keys(pkg[group] ?? {}));
  return names.filter((name) => FORBIDDEN_PACKAGES.some((entry) => (entry.endsWith("/") ? name.startsWith(entry) : name === entry)));
}

// The project's own client modules in one client reference manifest: the
// keys of its clientModules (Next.js names them "[project]/<path>#export"),
// leaving out Next.js's own, under node_modules/next/. The manifest is a
// script that assigns to globalThis.__RSC_MANIFEST; it runs in an empty
// context, so it can reach nothing else.
export function projectClientModules(manifestSource: string): string[] {
  const sandbox: { __RSC_MANIFEST?: Record<string, { clientModules?: Record<string, unknown> }> } = {};
  runInNewContext(manifestSource, { globalThis: sandbox });
  const modules = new Set<string>();
  for (const entry of Object.values(sandbox.__RSC_MANIFEST ?? {})) {
    for (const key of Object.keys(entry.clientModules ?? {})) {
      const path = key.replace(/^\[project\]\//, "").replace(/#.*$/, "");
      if (!path.startsWith("node_modules/next/")) modules.add(path);
    }
  }
  return [...modules].sort();
}

export function clientModuleProblems(manifest: string, modules: readonly string[]): string[] {
  const listing = (LISTING_MANIFESTS as readonly string[]).includes(manifest);
  return modules
    .filter((module) => !module.startsWith(ANALYTICS_PREFIX))
    .filter((module) => listing || !(ISLANDS as readonly string[]).includes(module))
    .map((module) =>
      listing && (ISLANDS as readonly string[]).includes(module)
        ? `${manifest}: a listing ships the island ${module}; neither listing may hydrate (AD-2)`
        : `${manifest}: ships client code from ${module}, which is not one of the two islands (NFR-7)`,
    );
}

// A PNG's width and height from its IHDR chunk.
export function pngSize(bytes: Uint8Array): { width: number; height: number } | null {
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytes.length < 24 || signature.some((byte, i) => bytes[i] !== byte)) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

export type PortraitReading = {
  count: number;
  loading: string | null;
  fetchPriority: string | null;
  highPriorityPreloads: number;
  naturalWidth: number;
  naturalHeight: number;
  renderedWidth: number;
};

export function portraitProblems(page: string, width: number, hero: boolean, reading: PortraitReading, heroFetchPriority = HERO_FETCH_PRIORITY): string[] {
  const where = `${page} at ${width}px`;
  const problems: string[] = [];
  if (reading.count !== 1) return [`${where}: ${reading.count} portrait <img> elements, expected exactly one`];
  if (hero) {
    if (reading.loading !== "eager") problems.push(`${where}: the hero portrait is loading="${reading.loading ?? "(unset)"}", expected eager`);
    if (reading.fetchPriority === "high" && !heroFetchPriority) problems.push(`${where}: the hero portrait has fetchpriority="high" without AD-12's recorded step`);
  }
  if (reading.highPriorityPreloads > 0) problems.push(`${where}: a high-priority image preload (next/image priority); AD-12 allows none`);
  if (reading.naturalWidth > PORTRAIT_SIZE.width || reading.naturalHeight > PORTRAIT_SIZE.height) {
    problems.push(`${where}: the portrait decodes at ${reading.naturalWidth} x ${reading.naturalHeight}, upscaled past ${PORTRAIT_SIZE.width} x ${PORTRAIT_SIZE.height}`);
  }
  if (reading.naturalWidth > 0 && reading.renderedWidth > reading.naturalWidth) {
    problems.push(`${where}: the portrait is drawn ${reading.renderedWidth}px wide from ${reading.naturalWidth} decoded pixels`);
  }
  return problems;
}

// ---------------------------------------------------------------- the run

const freePort = (): Promise<number> =>
  new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, () => {
      const address = server.address();
      server.close(() => (typeof address === "object" && address !== null ? resolve(address.port) : reject(new Error("no port"))));
    });
  });

type LighthouseResult = { lhr: { categories: Record<string, { score: number | null }>; audits: Record<string, { numericValue?: number }>; environment?: { benchmarkIndex?: number }; runtimeError?: { message: string } } } | undefined;

async function measure(url: string, profile: Profile, port: number): Promise<Run> {
  const flags = { port, output: "json" as const, logLevel: "error" as const, onlyCategories: [...CATEGORIES] };
  const result = (await lighthouse(url, flags, profile === "desktop" ? desktopConfig : undefined)) as LighthouseResult;
  if (result === undefined) throw new Error(`Lighthouse returned nothing for ${url}`);
  if (result.lhr.runtimeError) throw new Error(`Lighthouse could not measure ${url}: ${result.lhr.runtimeError.message}`);
  // A null score (Lighthouse could not score the category) is NaN, never 0
  // or a pass: median() then fails the page.
  const scoreOf = (category: Category): number => {
    const score = result.lhr.categories[category]?.score;
    return typeof score === "number" ? Math.round(score * 100) : Number.NaN;
  };
  const scores = Object.fromEntries(CATEGORIES.map((category) => [category, scoreOf(category)])) as Record<Category, number>;
  return { scores, lcpMs: result.lhr.audits["largest-contentful-paint"]?.numericValue ?? Number.NaN, benchmarkIndex: result.lhr.environment?.benchmarkIndex };
}

async function readPortrait(browser: Browser, url: string, src: string, width: number): Promise<PortraitReading> {
  const context = await browser.newContext({ viewport: { width, height: 900 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  try {
    await page.goto(url, { waitUntil: "load" });
    await page.evaluate(async (needle) => {
      const img = [...document.images].find((each) => each.currentSrc.includes(needle) || each.src.includes(needle));
      img?.scrollIntoView();
      // Load or error, whichever comes first, and never longer than 10s.
      if (img && !img.complete)
        await new Promise((resolve) => {
          img.addEventListener("load", resolve, { once: true });
          img.addEventListener("error", resolve, { once: true });
          setTimeout(resolve, 10_000);
        });
    }, src);
    return await page.evaluate((needle) => {
      const imgs = [...document.querySelectorAll("img")].filter((img) => (img.getAttribute("src") ?? "").includes(needle) || (img.getAttribute("srcset") ?? "").includes(needle));
      const img = imgs[0];
      const preloads = [...document.querySelectorAll('link[rel="preload"][as="image"]')].filter((link) => (link.getAttribute("fetchpriority") ?? "").toLowerCase() === "high");
      return {
        count: imgs.length,
        loading: img?.getAttribute("loading") ?? null,
        fetchPriority: img?.getAttribute("fetchpriority") ?? null,
        highPriorityPreloads: preloads.length,
        naturalWidth: img?.naturalWidth ?? 0,
        naturalHeight: img?.naturalHeight ?? 0,
        renderedWidth: Math.round(img?.getBoundingClientRect().width ?? 0),
      };
    }, src);
  } finally {
    await context.close();
  }
}

function manifestFiles(root: string, dir = root): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return manifestFiles(root, path);
    return entry.name === "page_client-reference-manifest.js" ? [path.slice(root.length + 1)] : [];
  });
}

export type Result = { measured: Measured[]; failures: string[] };

export async function checkLighthouse(baseUrl: string, out: (text: string) => void = () => {}): Promise<Result> {
  const failures: string[] = [];

  // NFR-7, from the repository and the build.
  for (const name of forbiddenPackages(readFileSync("package.json", "utf8"))) failures.push(`package.json: ${name} is a component library, CSS framework or animation library (NFR-7)`);
  const manifestRoot = ".next/server/app";
  let manifests: string[] = [];
  try {
    manifests = manifestFiles(manifestRoot);
  } catch {
    // No build output at all: reported below, like an empty one.
  }
  if (manifests.length === 0) failures.push(`${manifestRoot}: no client reference manifests; run npm run build first`);
  for (const listing of LISTING_MANIFESTS) if (!manifests.includes(listing)) failures.push(`${manifestRoot}/${listing}: missing, so the listing's client code cannot be checked`);
  for (const manifest of manifests) failures.push(...clientModuleProblems(manifest, projectClientModules(readFileSync(join(manifestRoot, manifest), "utf8"))));

  // AD-12 portrait files.
  for (const portrait of PORTRAITS) {
    const size = pngSize(readFileSync(portrait.file));
    if (size === null || size.width !== PORTRAIT_SIZE.width || size.height !== PORTRAIT_SIZE.height) {
      failures.push(`${portrait.file}: ${size === null ? "not a PNG" : `${size.width} x ${size.height}`}, expected its natural ${PORTRAIT_SIZE.width} x ${PORTRAIT_SIZE.height}`);
    }
  }

  const port = await freePort();
  const browser = await chromium.launch({ args: [`--remote-debugging-port=${port}`] });
  const measured: Measured[] = [];
  try {
    for (const portrait of PORTRAITS) {
      for (const width of [375, 1440]) {
        failures.push(...portraitProblems(portrait.page, width, portrait.hero, await readPortrait(browser, new URL(portrait.page, baseUrl).href, portrait.src, width)));
      }
    }
    for (const page of PAGES) {
      for (const profile of PROFILES) {
        const runs: Run[] = [];
        for (let i = 0; i < RUNS; i++) runs.push(await measure(new URL(page, baseUrl).href, profile, port));
        const result = medianOf(page, profile, runs);
        measured.push(result);
        out(`  ${page} (${profile}): ${CATEGORIES.map((c) => `${c} ${result.scores[c]}`).join(", ")}; LCP ${(result.lcpMs / 1000).toFixed(2)}s (median of ${RUNS}); host CPU benchmark ${runs.map((r) => Math.round(r.benchmarkIndex ?? 0)).join("/")}\n`);
        failures.push(...thresholdProblems(result));
      }
    }
  } finally {
    await browser.close();
  }
  return { measured, failures };
}

if (isEntryPoint(import.meta.url)) {
  const base = process.argv[2];
  if (base === undefined || process.argv.length !== 3 || !/^https?:\/\//.test(base)) {
    console.error("usage: node scripts/check-lighthouse.mts <base-url>");
    process.exit(2);
  }
  process.stdout.write(`check-lighthouse: ${PAGES.length} pages, ${PROFILES.join(" and ")}, median of ${RUNS} runs each\n`);
  checkLighthouse(base, (text) => process.stdout.write(text)).then(
    (result) => {
      if (result.failures.length === 0) {
        process.stdout.write(`check-lighthouse: every category at least ${MIN_SCORE} on both profiles, Home's mobile LCP under ${HOME_MOBILE_LCP_MS / 1000}s, portraits and client code as AD-12 and NFR-7 require.\n`);
        process.exit(0);
      }
      process.stdout.write(`check-lighthouse: ${result.failures.length} failure(s):\n${result.failures.map((f) => `  ${f}`).join("\n")}\n`);
      process.exit(1);
    },
    (error: unknown) => {
      console.error(`check-lighthouse: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    },
  );
}
