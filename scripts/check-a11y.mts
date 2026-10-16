// A keyboard or screen reader user can use the whole site (Story 5.3), and
// it holds at every width it claims (Story 5.5). Run in the gate against
// `next start`, after the build:
//
//   node scripts/check-a11y.mts <base-url>     e.g. http://localhost:3000
//
// Not a Playwright test (AD-18 caps those at one): this script drives
// Chromium directly through the playwright library that @playwright/test
// ships, over the link check's own crawl (crawlSite in
// scripts/check-links.mts): every route, both detail families, every filter
// state and the two not-found pages. On each page:
//
// 1. axe (axe-core, injected) at 1440 wide: any violation of serious or
//    critical impact fails, naming the route and the rule. Text contrast is
//    axe's color-contrast rule. The page runs with reduced motion, so the
//    scroll reveal holds every band at rest and axe reads it as a reader does.
// 2. Landmarks (landmarkProblems): exactly one header, one
//    nav[aria-label="Primary"], one main and one footer, a header or footer
//    counting as the page's banner or contentinfo only outside main,
//    article, aside, nav and section (a detail page's own header is not). A detail page
//    (/experience/<slug>, /projects/<slug>) has the section rail as a
//    second nav, inside main.
// 3. Headings (headingProblems): the first is an h1 and none skips a level
//    going down.
// 4. Focus (focusProblems): the page is walked with the Tab key; every
//    element that takes focus draws an outline at least 1px wide whose
//    colour has at least 3:1 contrast against the ground it sits on, the
//    ancestors' backgrounds composited down to the nearest opaque one (a
//    translucent ring composited over it too), never the element's own fill. On a
//    project page the repository call to action must be among them.
// 5. Widths (WIDTHS): at 320, 375, 768 and 1440 the document never scrolls
//    sideways (scrollWidth no wider than clientWidth). At 320 the primary nav
//    holds its items inline on at most two lines, with no disclosure control
//    (no button, details or aria-expanded in the header). At 768 every card
//    grid ([data-card-grid]) and the section rail sit inside the viewport and
//    do not overflow their own box, and each unfiltered listing must show a
//    grid, so the rule is never vacuous. The rail rule holds only on a
//    detail page that answered 200. Home's fold at 320 is measured and printed (the bottom of
//    the hero's text stack against UX-DR47's 550px fold), not enforced: the
//    fold contract is 375 x 550.
//
// Exit 1 names each failure by route, width and rule.

import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

import { chromium, type Browser, type Page } from "@playwright/test";

import { crawlSite, makeHttp, type CrawledPage } from "./check-links.mts";
import { isEntryPoint } from "./entry-point.mts";

export const WIDTHS = [320, 375, 768, 1440] as const;
export const HEIGHT = 900;
export const AXE_WIDTH = 1440;
export const FAILING_IMPACTS = ["serious", "critical"] as const;
export const MIN_RING_CONTRAST = 3;
export const NAV_MAX_LINES = 2;
export const FOLD_HEIGHT = 550;
// The most Tab presses one page gets before the walk stops; past it fails.
export const MAX_TABS = 300;

// ---------------------------------------------------------------- pure helpers

export type Rgba = { r: number; g: number; b: number; a: number };

// A computed colour, rgb() or rgba(), in either syntax; null otherwise.
export function parseColour(text: string): Rgba | null {
  const match = /^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/.exec(text.trim());
  if (match === null) return null;
  const alpha = match[4] === undefined ? 1 : match[4].endsWith("%") ? Number(match[4].slice(0, -1)) / 100 : Number(match[4]);
  return { r: Number(match[1]), g: Number(match[2]), b: Number(match[3]), a: alpha };
}

const channel = (value: number): number => {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};

export const luminance = ({ r, g, b }: Rgba): number => 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);

// WCAG contrast ratio of two opaque colours.
export function contrastRatio(a: Rgba, b: Rgba): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

export type Landmarks = { header: number; primaryNav: number; main: number; footer: number; nav: number; navInMain: number };

export const isDetailRoute = (path: string): boolean => /^\/(experience|projects)\/[^/?]+$/.test(path);

// status is what the route answered: the rail rule holds only for a written
// detail page (200), never for a not-found answer under the same prefix.
export function landmarkProblems(path: string, found: Landmarks, status = 200): string[] {
  const problems: string[] = [];
  for (const [key, label] of [
    ["header", "header"],
    ["primaryNav", 'nav[aria-label="Primary"]'],
    ["main", "main"],
    ["footer", "footer"],
  ] as const) {
    if (found[key] !== 1) problems.push(`has ${found[key]} ${label}, expected exactly one`);
  }
  if (isDetailRoute(path) && status === 200 && (found.navInMain !== 1 || found.nav !== 2)) {
    problems.push(`a detail page needs the section rail as a second nav inside main; found ${found.nav} nav, ${found.navInMain} inside main`);
  }
  return problems;
}

// Heading levels in document order: the first must be 1, and none may go
// down more than one level from the one before.
export function headingProblems(levels: readonly number[]): string[] {
  if (levels.length === 0) return ["has no heading"];
  const problems: string[] = [];
  if (levels[0] !== 1) problems.push(`the first heading is an h${levels[0]}, not an h1`);
  for (let i = 1; i < levels.length; i++) {
    if (levels[i] > levels[i - 1] + 1) problems.push(`heading ${i + 1} skips from h${levels[i - 1]} to h${levels[i]}`);
  }
  return problems;
}

// Each focused element's outline, and the computed background colours of its
// ancestors, nearest first, as the browser reports them.
export type FocusStop = { label: string; href?: string; outlineStyle: string; outlineWidth: number; outlineColour: string; grounds: string[] };

// One colour laid over another (source-over); the result is opaque when the
// bottom one is.
export function composite(top: Rgba, bottom: Rgba): Rgba {
  const a = top.a + bottom.a * (1 - top.a);
  if (a === 0) return { r: 0, g: 0, b: 0, a: 0 };
  const mix = (t: number, b: number): number => (t * top.a + b * bottom.a * (1 - top.a)) / a;
  return { r: mix(top.r, bottom.r), g: mix(top.g, bottom.g), b: mix(top.b, bottom.b), a };
}

export const WHITE: Rgba = { r: 255, g: 255, b: 255, a: 1 };

// The ground an element sits on: its ancestors' backgrounds, nearest first,
// composited from the nearest opaque one (or the white canvas) up through
// every translucent layer above it. Null when one cannot be read.
export function effectiveGround(grounds: readonly string[]): Rgba | null {
  const layers: Rgba[] = [];
  for (const text of grounds) {
    if (text.trim() === "transparent") continue;
    const colour = parseColour(text);
    if (colour === null) return null;
    if (colour.a === 0) continue;
    layers.push(colour);
    if (colour.a >= 1) break;
  }
  let ground = layers.length > 0 && layers[layers.length - 1].a >= 1 ? layers.pop()! : WHITE;
  for (const layer of layers.reverse()) ground = composite(layer, ground);
  return ground;
}

export function focusProblems(stops: readonly FocusStop[]): string[] {
  const problems: string[] = [];
  for (const stop of stops) {
    if (stop.outlineStyle === "none" || stop.outlineWidth < 1) {
      problems.push(`${stop.label} shows no focus outline`);
      continue;
    }
    const ringColour = parseColour(stop.outlineColour);
    const ground = effectiveGround(stop.grounds);
    if (ringColour === null || ground === null) {
      problems.push(`${stop.label}: the focus ring or its ground could not be read`);
      continue;
    }
    // A translucent ring is seen as it composites over its ground.
    const ratio = contrastRatio(composite(ringColour, ground), ground);
    if (ratio < MIN_RING_CONTRAST) problems.push(`${stop.label}: focus ring contrast ${ratio.toFixed(2)}:1 against its ground, below ${MIN_RING_CONTRAST}:1`);
  }
  return problems;
}

// Horizontal scroll: the document is wider than its viewport.
export const overflows = (scrollWidth: number, clientWidth: number): boolean => scrollWidth > clientWidth;

// How many lines a set of items sits on, by the top of each box (within 2px).
export function lineCount(tops: readonly number[]): number {
  const lines: number[] = [];
  for (const top of [...tops].sort((a, b) => a - b)) if (!lines.some((line) => Math.abs(line - top) <= 2)) lines.push(top);
  return lines.length;
}

export type AxeViolation = { id: string; impact: string | null; nodes: number };

export const failingViolations = (violations: readonly AxeViolation[]): AxeViolation[] =>
  violations.filter((v) => (FAILING_IMPACTS as readonly string[]).includes(v.impact ?? ""));

// ---------------------------------------------------------------- in the browser

const AXE_SOURCE = (): string => readFileSync(createRequire(import.meta.url).resolve("axe-core/axe.min.js"), "utf8");

async function runAxe(page: Page, source: string): Promise<AxeViolation[]> {
  await page.addScriptTag({ content: source });
  return page.evaluate(async () => {
    const axe = (window as unknown as { axe: { run: (context: Document, options: object) => Promise<{ violations: Array<{ id: string; impact: string | null; nodes: unknown[] }> }> } }).axe;
    const result = await axe.run(document, { resultTypes: ["violations"] });
    return result.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length }));
  });
}

// header and footer count only as the page's banner and contentinfo: one
// inside main, article, aside, nav or section (a detail page's own header)
// is not a landmark, so it is not counted.
const readLandmarks = (page: Page): Promise<Landmarks> =>
  page.evaluate(() => ({
    header: [...document.querySelectorAll("header")].filter((el) => el.parentElement?.closest("main, article, aside, nav, section") == null).length,
    primaryNav: document.querySelectorAll('nav[aria-label="Primary"]').length,
    main: document.querySelectorAll("main").length,
    footer: [...document.querySelectorAll("footer")].filter((el) => el.parentElement?.closest("main, article, aside, nav, section") == null).length,
    nav: document.querySelectorAll("nav").length,
    navInMain: document.querySelectorAll("main nav").length,
  }));

const readHeadings = (page: Page): Promise<number[]> =>
  page.evaluate(() => [...document.querySelectorAll("h1, h2, h3, h4, h5, h6")].map((h) => Number(h.tagName.slice(1))));

// Walks the page with Tab from the top, recording each focused element's
// outline and the ground behind it, until focus leaves the document or
// comes back to the first stop.
async function walkFocus(page: Page): Promise<{ stops: FocusStop[]; complete: boolean }> {
  await page.evaluate(() => {
    (document.activeElement as HTMLElement | null)?.blur();
    window.scrollTo(0, 0);
  });
  const stops: FocusStop[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < MAX_TABS; i++) {
    await page.keyboard.press("Tab");
    const stop = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (el === null || el === document.body || el === document.documentElement) return null;
      const path: string[] = [];
      for (let node: Element | null = el; node !== null && node !== document.body; node = node.parentElement) {
        const parent: Element | null = node.parentElement;
        path.unshift(`${node.tagName.toLowerCase()}:${parent === null ? 0 : [...parent.children].indexOf(node)}`);
      }
      const style = getComputedStyle(el);
      // Every ancestor's background, nearest first; the colour is worked
      // out in Node (effectiveGround), where it is tested.
      const grounds: string[] = [];
      for (let node: Element | null = el.parentElement; node !== null; node = node.parentElement) grounds.push(getComputedStyle(node).backgroundColor);
      const text = (el.getAttribute("aria-label") ?? el.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 50);
      const href = el.getAttribute("href");
      return {
        key: path.join("/"),
        label: `<${el.tagName.toLowerCase()}${href ? ` href="${href}"` : ""}> "${text}"`,
        href: href ?? "",
        outlineStyle: style.outlineStyle,
        outlineWidth: parseFloat(style.outlineWidth) || 0,
        outlineColour: style.outlineColor,
        grounds,
      };
    });
    if (stop === null || seen.has(stop.key)) return { stops, complete: true };
    seen.add(stop.key);
    stops.push(stop);
  }
  return { stops, complete: false };
}

type WidthReading = {
  scrollWidth: number;
  clientWidth: number;
  navLineTops: number[];
  disclosure: boolean;
  boxes: Array<{ label: string; right: number; scrollWidth: number; clientWidth: number }>;
  foldBottom: number | null;
};

const readWidth = (page: Page): Promise<WidthReading> =>
  page.evaluate(() => {
    const root = document.documentElement;
    const header = document.querySelector("header");
    const navItems = [...document.querySelectorAll('nav[aria-label="Primary"] a')];
    const boxes = [
      ...[...document.querySelectorAll("[data-card-grid]")].map((el) => ({ label: "a card grid", el })),
      ...[...document.querySelectorAll("main nav")].map((el) => ({ label: "the section rail", el })),
    ].map(({ label, el }) => ({ label, right: el.getBoundingClientRect().right, scrollWidth: el.scrollWidth, clientWidth: el.clientWidth }));
    const heroText = document.querySelector("main section[aria-labelledby='home-name'] > div");
    return {
      scrollWidth: root.scrollWidth,
      clientWidth: root.clientWidth,
      navLineTops: navItems.map((a) => a.getBoundingClientRect().top),
      disclosure: header !== null && header.querySelector("button, details, [aria-expanded]") !== null,
      boxes,
      foldBottom: heroText === null ? null : heroText.getBoundingClientRect().bottom + window.scrollY,
    };
  });

// ---------------------------------------------------------------- the run

export type Failure = { route: string; rule: string };
export type Result = { routes: number; failures: Failure[]; fold320: number | null; focusStops: number; repositoryCtaChecked: number };

// The unfiltered listings, each of which must show a card grid at 768px.
export const LISTINGS = ["/experience", "/projects"] as const;

async function auditPage(browser: Browser, url: string, path: string, status: number, axeSource: string, result: Result): Promise<void> {
  const fail = (rule: string): void => {
    result.failures.push({ route: path, rule });
  };
  const context = await browser.newContext({ viewport: { width: AXE_WIDTH, height: HEIGHT }, reducedMotion: "reduce" });
  const page = await context.newPage();
  try {
    await page.goto(url, { waitUntil: "load" });
    for (const v of failingViolations(await runAxe(page, axeSource))) fail(`axe ${v.impact}: ${v.id} (${v.nodes} element(s))`);
    for (const problem of landmarkProblems(path, await readLandmarks(page), status)) fail(problem);
    for (const problem of headingProblems(await readHeadings(page))) fail(problem);

    const walk = await walkFocus(page);
    if (!walk.complete) fail(`the Tab walk did not finish within ${MAX_TABS} presses`);
    result.focusStops += walk.stops.length;
    for (const problem of focusProblems(walk.stops)) fail(problem);
    if (/^\/projects\/[^/?]+$/.test(path)) {
      const hasRepository = await page.evaluate(() => document.querySelector('main a[href^="https://github.com/shahrouzmohaghegh/"]') !== null);
      if (hasRepository) {
        const checked = walk.stops.filter((stop) => stop.href?.startsWith("https://github.com/shahrouzmohaghegh/"));
        if (checked.length === 0) fail("the repository call to action never took keyboard focus");
        else result.repositoryCtaChecked += 1;
      }
    }

    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: HEIGHT });
      await page.goto(url, { waitUntil: "load" });
      const reading = await readWidth(page);
      if (overflows(reading.scrollWidth, reading.clientWidth)) fail(`scrolls sideways at ${width}px (${reading.scrollWidth}px of content in ${reading.clientWidth}px)`);
      if (width === 320) {
        const lines = lineCount(reading.navLineTops);
        if (lines > NAV_MAX_LINES) fail(`the primary nav takes ${lines} lines at 320px, more than ${NAV_MAX_LINES}`);
        if (reading.disclosure) fail("the header has a disclosure control; the nav must stay inline");
        if (path === "/") result.fold320 = reading.foldBottom;
      }
      if (width === 768) {
        for (const box of reading.boxes) {
          if (box.right > reading.clientWidth + 0.5 || box.scrollWidth > box.clientWidth) fail(`${box.label} does not resolve at 768px`);
        }
        if ((LISTINGS as readonly string[]).includes(path) && !reading.boxes.some((box) => box.label === "a card grid")) fail("no card grid found at 768px, so the grid rule was not checked");
      }
    }
  } catch (error) {
    fail(`could not be audited: ${error instanceof Error ? error.message.split("\n")[0] : String(error)}`);
  } finally {
    await context.close();
  }
}

export async function checkA11y(baseUrl: string): Promise<Result> {
  const crawl = await crawlSite(baseUrl, { http: makeHttp() });
  const result: Result = { routes: 0, failures: [], fold320: null, focusStops: 0, repositoryCtaChecked: 0 };
  if (crawl.stoppedWithQueued !== null) result.failures.push({ route: "crawl", rule: "stopped before the whole site was read" });
  const pages: CrawledPage[] = crawl.pages.filter((page) => {
    if (page.status === page.expected) return true;
    result.failures.push({ route: page.path, rule: `answered ${page.status ?? "nothing"}, expected ${page.expected}` });
    return false;
  });
  const axeSource = AXE_SOURCE();
  const browser = await chromium.launch();
  try {
    for (const page of pages) {
      await auditPage(browser, page.url, page.path, page.status ?? 0, axeSource, result);
      result.routes += 1;
    }
  } finally {
    await browser.close();
  }
  return result;
}

export function report(result: Result): string {
  const fold =
    result.fold320 === null
      ? "Home fold at 320px: not measured."
      : `Home fold at 320px: the hero text stack ends at ${Math.round(result.fold320)}px against the ${FOLD_HEIGHT}px fold (${result.fold320 > FOLD_HEIGHT ? `overruns by ${Math.round(result.fold320 - FOLD_HEIGHT)}px` : "fits"}); recorded, not enforced.`;
  const lines = [
    `check-a11y: ${result.routes} route(s) at ${WIDTHS.join(", ")}px; ${result.focusStops} focus stop(s) checked; repository call to action checked on ${result.repositoryCtaChecked} page(s).`,
    fold,
  ];
  if (result.failures.length === 0) lines.push("No serious or critical axe violation, landmark, heading, focus or width problem.");
  else lines.push(`${result.failures.length} failure(s):`, ...result.failures.map((f) => `  ${f.route}: ${f.rule}`));
  return `${lines.join("\n")}\n`;
}

if (isEntryPoint(import.meta.url)) {
  const base = process.argv[2];
  if (base === undefined || process.argv.length !== 3 || !/^https?:\/\//.test(base)) {
    console.error("usage: node scripts/check-a11y.mts <base-url>");
    process.exit(2);
  }
  checkA11y(base).then(
    (result) => {
      process.stdout.write(report(result));
      process.exit(result.failures.length === 0 ? 0 : 1);
    },
    (error: unknown) => {
      console.error(`check-a11y: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    },
  );
}
