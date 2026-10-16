// The /experience listing (Story 3.1). Renders app/experience/page.tsx to
// static markup and checks what a visitor reads: the h1, the one intro line
// from content/experience.ts, then one evidence card per case study in
// collection order, each an article with an h2 title link and the CTA to its
// href, so the headings run h1 then one h2 per card. A mocked collection with
// an item added or removed changes the card count, which proves the route
// follows lib/evidence with no edit to the page. The title comes from
// listingTitle in lib/evidence, for /projects too, and the root template adds
// the site name once. Unfiltered, the listing asks for no noindex; it renders
// per request because it reads search params (AD-4), and hydrates no island.
// The capability filter (Epic 4) is checked against the spec's I/O matrix:
// unfiltered, one capability, a union, a liberal read, all unknown or empty,
// and no match here with a match on /projects. Static markup is what a
// visitor with JavaScript off gets, so every chip, card and link is checked
// there, and a chip is a plain link that filters by full page load.

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";

import gridStyles from "@/components/card-grid.module.css";
import cardStyles from "@/components/evidence-card.module.css";
import { metricSentence } from "@/components/evidence-card";
import filterStyles from "@/components/capability-filter.module.css";
import { capabilityFilter } from "@/content/capability-filter";
import { experience } from "@/content/experience";
import {
  CAPABILITY_NAME,
  caseStudyItems,
  crossListing,
  listingTitle,
  projectItems,
  stateLine,
  type Capability,
  type EvidenceItem,
} from "@/lib/evidence";
import { metadata as rootMetadata } from "../layout";
import * as projectsModule from "../projects/page";
import * as experienceModule from "./page";

const ExperiencePage = experienceModule.default;
type SearchParams = Record<string, string | string[] | undefined>;
const props = (searchParams: SearchParams = {}) => ({ searchParams: Promise.resolve(searchParams) });
const metadataFor = (searchParams: SearchParams = {}) => experienceModule.generateMetadata(props(searchParams));
const projectsMetadata = await projectsModule.generateMetadata(props());
const unfilteredMetadata = await metadataFor();

const decode = (s: string): string =>
  s
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
const escapeRegExp = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const text = (fragment: string): string => decode(fragment.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
// Text as read, without the space text() puts at every tag boundary.
const tight = (fragment: string): string => decode(fragment.replace(/<[^>]*>/g, "")).replace(/\s+/g, " ").trim();
const source = (path: string): string => readFileSync(join(process.cwd(), path), "utf8");

type ListingPage = (p: ReturnType<typeof props>) => Promise<unknown>;
const render = async (page: ListingPage, searchParams: SearchParams = {}): Promise<string> =>
  renderToStaticMarkup(<>{(await page(props(searchParams))) as ReactNode}</>);
const mainOf = (html: string): string => html.slice(html.search(/<main[\s>]/), html.lastIndexOf("</main>"));
const cardsIn = (fragment: string): string[] => fragment.split("<article").slice(1).map((card) => card.slice(0, card.indexOf("</article>")));

const html = await render(ExperiencePage);
const main = mainOf(html);

describe("the /experience listing", () => {
  test("content/experience.ts holds the reviewed words", () => {
    expect(experience).toEqual({
      heading: "Experience",
      description:
        "Case studies in engineering leadership: an offshore delivery turnaround, AI-native engineering measured across pilot projects, and a standing seat on the Digital Governance Board.",
      intro: "Work from regulated healthcare, each with the decisions behind it, what they cost, and the measured outcome.",
      cta: "Read the case study",
      empty: "The case studies tell the organisational story. Hands-on evidence is carried by the systems themselves, so it lives on Projects.",
    });
  });

  test("the h1 comes first, then the intro line, then the cards", () => {
    const h1 = main.search(new RegExp(`<h1[^>]*>${escapeRegExp(experience.heading)}</h1>`));
    const intro = main.search(new RegExp(`<p[^>]*>${escapeRegExp(experience.intro)}</p>`));
    const firstCard = main.indexOf("<article");
    expect(h1, "the h1 renders").toBeGreaterThan(-1);
    expect(intro, "the intro renders after the h1").toBeGreaterThan(h1);
    expect(firstCard, "the cards render after the intro").toBeGreaterThan(intro);
  });

  test("one card per case study, in collection order, each complete", () => {
    const cards = cardsIn(main);
    expect(cards, "one card per case study").toHaveLength(caseStudyItems.length);
    cards.forEach((card, i) => {
      const item = caseStudyItems[i];
      const hrefs = [...card.matchAll(/<a [^>]*href="([^"]*)"/g)].map((m) => m[1]);
      expect(hrefs, `${item.slug}: title and CTA link to its page`).toEqual([item.href, item.href]);
      expect(card, `${item.slug}: linked h2 title`).toMatch(new RegExp(`<h2[^>]*><a [^>]*>${escapeRegExp(item.title)}</a></h2>`));
      for (const capability of item.capabilities) {
        expect(text(card), `${item.slug}: eyebrow ${capability}`).toContain(CAPABILITY_NAME[capability]);
      }
      expect(decode(card), `${item.slug}: metric with its qualifier`).toContain(`>${metricSentence(item)}</p>`);
      expect(decode(card), `${item.slug}: summary`).toContain(`>${item.summary}</p>`);
      expect(text(card), `${item.slug}: CTA`).toMatch(new RegExp(`${escapeRegExp(experience.cta)}$`));
      expect(card, `${item.slug}: card styles`).toContain(`class="${cardStyles.metric}"`);
    });
  });

  test("headings run the h1, then one h2 per card, with no level skipped", () => {
    const headings = [...html.matchAll(/<(h[1-6])[^>]*>([\s\S]*?)<\/\1>/g)].map((m) => `${m[1]} ${text(m[2])}`);
    expect(headings).toEqual([`h1 ${experience.heading}`, ...caseStudyItems.map((item) => `h2 ${item.title}`)]);
  });

  test("the cards sit in the shared card grid, one list item each", () => {
    expect(main.split(`<ul class="${gridStyles.grid}" data-card-grid="">`), "one card grid").toHaveLength(2);
    expect(main.split(`<li class="${gridStyles.item}"><article`), "one grid item per card").toHaveLength(caseStudyItems.length + 1);
  });

  test("unfiltered: no chip is selected, no live region, no form control, and the cross-listing link counts every project", () => {
    expect(main).not.toMatch(/role="status"|aria-live|aria-pressed|aria-current="true"/);
    expect(main).not.toMatch(/<form[\s>]|<input[\s>]|<button[\s>]/);
    expect(main).toContain(`href="/projects#filter-status"`);
    expect(text(main)).toContain(`${projectItems.length} Projects are listed separately`);
  });

  test("app/experience/page.tsx passes the collection to the filtered listing and lists no item itself", () => {
    const page = source("app/experience/page.tsx");
    expect(page).toMatch(/<FilteredListing\s+kind="case-study"\s+selection=\{selection\}\s+items=\{caseStudyItems\}/);
    for (const item of caseStudyItems) {
      expect(page, `app/experience/page.tsx names ${item.slug}`).not.toContain(item.slug);
      expect(page, `app/experience/page.tsx names ${item.title}`).not.toContain(item.title);
    }
  });

  test.each([
    ["added", (items: readonly EvidenceItem[]) => [...items, { ...items[0], slug: "mock-added", title: "A mocked case study", href: "/experience/mock-added" }]],
    ["removed", (items: readonly EvidenceItem[]) => items.slice(1)],
  ])("a mocked collection with an item %s changes the card count", async (_change, change) => {
    vi.resetModules();
    vi.doMock("@/lib/evidence", async (importOriginal) => {
      const actual = await importOriginal<typeof import("@/lib/evidence")>();
      return { ...actual, caseStudyItems: change(actual.caseStudyItems) };
    });
    try {
      const mocked = await import("./page");
      const cards = cardsIn(mainOf(await render(mocked.default)));
      const expected = change(caseStudyItems);
      expect(cards).toHaveLength(expected.length);
      expect(cards.map((card) => card.match(/href="([^"]*)"/)?.[1])).toEqual(expected.map((item) => item.href));
      // A filtered view follows the mocked collection too.
      const filtered = expected.filter((item) => item.capabilities.includes("leadership"));
      const filteredMain = mainOf(await render(mocked.default, { capability: "leadership" }));
      expect(cardsIn(filteredMain).map((card) => card.match(/href="([^"]*)"/)?.[1])).toEqual(filtered.map((item) => item.href));
      expect(tight(filteredMain)).toContain(`Showing ${filtered.length} of ${expected.length} case studies`);
    } finally {
      vi.doUnmock("@/lib/evidence");
      vi.resetModules();
    }
  });
});

describe("the listing titles", () => {
  const template = (rootMetadata.title as { template: string }).template;

  test("/experience and /projects take metadata.title from listingTitle", () => {
    expect(unfilteredMetadata.title).toBe(listingTitle("case-study"));
    expect(projectsMetadata.title).toBe(listingTitle("project"));
  });

  test("the h1 and the title name the listing the same way", () => {
    expect(experience.heading).toBe(listingTitle("case-study"));
  });

  test("the root template renders each with the site name once", () => {
    expect(template.replace("%s", String(unfilteredMetadata.title))).toBe("Experience | Shahrouz Mohaghegh");
    expect(template.replace("%s", String(projectsMetadata.title))).toBe("Projects | Shahrouz Mohaghegh");
  });

  test("a filtered view's title carries its count, with the site name once", async () => {
    const title = String((await metadataFor({ capability: "leadership,ai-native" })).title);
    expect(template.replace("%s", title)).toBe("Experience, 2 of 3 case studies, Engineering Leadership or AI-Native Engineering | Shahrouz Mohaghegh");
  });

  test("neither route composes its own title", () => {
    for (const path of ["app/experience/page.tsx", "app/projects/page.tsx"]) {
      expect(source(path), path).toMatch(/title:\s*listingTitle\("(case-study|project)", selection, (caseStudyItems|projectItems)\)/);
      expect(source(path), path).not.toMatch(/Shahrouz Mohaghegh/);
    }
  });
});

describe("indexing and rendering", () => {
  // Every module specifier: import ... from, export ... from, bare import and import().
  const specifiers = (code: string): string[] =>
    [...code.matchAll(/\b(?:import|export)\s[^;]*?\bfrom\s*["']([^"']+)["']|\bimport\s*["']([^"']+)["']|\bimport\s*\(\s*["']([^"']+)["']/g)].map(
      (m) => m[1] ?? m[2] ?? m[3],
    );

  test("unfiltered /experience asks for no noindex", async () => {
    expect(unfilteredMetadata.robots).toBeUndefined();
    expect((await metadataFor({ capability: "zzz" })).robots).toBeUndefined();
    expect((await metadataFor({ capability: "" })).robots).toBeUndefined();
  });

  test("every filtered /experience URL asks for noindex", async () => {
    for (const capability of ["leadership", "hands-on", "ai-native,leadership", "Hands-On,zzz"]) {
      expect((await metadataFor({ capability })).robots, capability).toEqual({ index: false });
    }
  });

  test("/experience carries its meta description, from content/experience.ts", () => {
    expect(unfilteredMetadata.description).toBe(experience.description);
  });

  // AD-4: the listing reads search params, so it renders per request; the
  // build marks it dynamic. Nothing forces it, and it reads no request
  // beyond the params; only lib/evidence reads the capability parameter.
  test("the route renders dynamically from search params, through lib/evidence only", () => {
    const page = source("app/experience/page.tsx");
    expect(page).toMatch(/selectionFrom\(await searchParams\)/);
    expect(page).not.toMatch(/export const dynamic|cookies\(|headers\(|generateStaticParams|\.capability\b|\[["']capability["']\]/);
  });

  test("the route and the components it renders reach no island", () => {
    const islands = ["app/experience/page.tsx", "components/capability-filter.tsx", "components/card-grid.tsx", "components/evidence-card.tsx"].flatMap((path) =>
      specifiers(source(path)).filter((specifier) => /(^|\/)islands\//.test(specifier)),
    );
    expect(islands).toEqual([]);
  });

  test("only card-grid.module.css among the module stylesheets lays out the card grid's columns", () => {
    const sheets = (dir: string): string[] =>
      readdirSync(join(process.cwd(), dir), { withFileTypes: true }).flatMap((entry) => {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) return sheets(path);
        return entry.name.endsWith(".module.css") ? [path] : [];
      });
    const users = [...sheets("app"), ...sheets("components")].filter((path) => source(path).includes("--component-card-grid-columns"));
    expect(users).toEqual(["components/card-grid.module.css"]);
    expect(source("components/selected-work.tsx")).toMatch(/<CardGrid\s/);
  });
});

// The capability filter on /experience, against the spec's I/O matrix.
// Counts are read from the collections, never written in.
describe("the capability filter on /experience", () => {
  const total = caseStudyItems.length;
  const caseStudies = (count: number) => `${count} ${count === 1 ? "case study" : "case studies"}`;
  const carrying = (...capabilities: Capability[]) =>
    caseStudyItems.filter((item) => item.capabilities.some((c) => capabilities.includes(c)));
  const view = async (searchParams: SearchParams) => {
    const page = mainOf(await render(ExperiencePage, searchParams));
    return { main: page, cards: cardsIn(page), metadata: await metadataFor(searchParams) };
  };
  const chipsIn = (fragment: string) =>
    [...fragment.matchAll(new RegExp(`<a ([^>]*class="${filterStyles.chip}"[^>]*)>([\\s\\S]*?)</a>`, "g"))].map(([, attrs, inner]) => ({
      href: decode(attrs.match(/href="([^"]*)"/)?.[1] ?? ""),
      selected: /aria-current="true"/.test(attrs),
      label: tight(inner),
    }));
  const chipHref = (value?: string) => (value === undefined ? "/experience#filter-status" : `/experience?capability=${value}#filter-status`);

  test("the page order: h1, intro, chip label and group, state line, cross-listing link, then cards", () => {
    const at = (pattern: RegExp) => main.search(pattern);
    const order = [
      at(/<h1[\s>]/),
      at(new RegExp(`<p[^>]*>${escapeRegExp(experience.intro)}</p>`)),
      at(/<div role="group" aria-labelledby="capfilter"><p id="capfilter"/),
      at(new RegExp(`<ul class="${filterStyles.chips}">`)),
      at(/<p id="filter-status"/),
      at(/href="\/projects#filter-status"/),
      at(/<article/),
    ];
    for (const index of order) expect(index).toBeGreaterThan(-1);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  test("unfiltered: every case study, the title Experience, no noindex, canonical /experience, the unfiltered state line", async () => {
    const { cards, metadata, main: page } = await view({});
    expect(cards).toHaveLength(total);
    expect(metadata.title).toBe("Experience");
    expect(metadata.robots).toBeUndefined();
    expect(metadata.alternates?.canonical).toBe("/experience");
    expect(tight(page)).toContain(`Showing all ${caseStudies(total)}. No capability filter applied.`);
    expect(chipsIn(page).map((chip) => chip.selected)).toEqual([false, false, false, false]);
    expect(chipsIn(page).map((chip) => chip.href)).toEqual([
      chipHref("leadership"),
      chipHref("ai-native"),
      chipHref("executive-influence"),
      chipHref("hands-on"),
    ]);
  });

  test("one capability: matching items only, a counted title, the chip current, noindex", async () => {
    const { cards, metadata, main: page } = await view({ capability: "leadership" });
    const expected = carrying("leadership");
    expect(cards.map((card) => card.match(/href="([^"]*)"/)?.[1])).toEqual(expected.map((item) => item.href));
    expect(metadata.title).toBe(`Experience, ${expected.length} of ${caseStudies(total)}, Engineering Leadership`);
    expect(metadata.robots).toEqual({ index: false });
    expect(metadata.alternates?.canonical).toBe("/experience?capability=leadership");
    const [leadership, ...rest] = chipsIn(page);
    expect(leadership).toEqual({ href: chipHref(), selected: true, label: "\u2713Leadership, selected" });
    expect(rest.map((chip) => chip.selected)).toEqual([false, false, false]);
    expect(rest.map((chip) => chip.href)).toEqual([
      chipHref("leadership,ai-native"),
      chipHref("leadership,executive-influence"),
      chipHref("leadership,hands-on"),
    ]);
    const { emphasis, rest: sentence } = stateLine("case-study", ["leadership"]);
    expect(decode(page)).toContain(`<span class="${filterStyles.emphasis}">${emphasis}</span>${sentence}`);
  });

  test("a union: both capabilities' case studies, the title joined with or", async () => {
    const { cards, metadata } = await view({ capability: "ai-native,leadership" });
    const expected = carrying("ai-native", "leadership");
    expect(cards).toHaveLength(expected.length);
    expect(metadata.title).toBe(`Experience, ${expected.length} of ${caseStudies(total)}, Engineering Leadership or AI-Native Engineering`);
  });

  test.each(["Hands-On,leadership,leadership,zzz", "hands-on%2Cleadership", "HANDS-ON,Leadership", "leadership,hands-on"])(
    "a liberal read of %s is the canonical leadership,hands-on: same page, canonical URL and chip hrefs",
    async (capability) => {
      const canonical = await view({ capability: "leadership,hands-on" });
      const liberal = await view({ capability });
      expect(liberal.main).toBe(canonical.main);
      expect(liberal.metadata).toEqual(canonical.metadata);
      expect(liberal.metadata.alternates?.canonical).toBe("/experience?capability=leadership,hands-on");
      expect(chipsIn(liberal.main).map((chip) => chip.href)).toEqual([
        chipHref("hands-on"),
        chipHref("leadership,ai-native,hands-on"),
        chipHref("leadership,executive-influence,hands-on"),
        chipHref("leadership"),
      ]);
    },
  );

  test.each([["zzz"], [""], [","]])("all unknown or empty (%j) renders unfiltered, canonical /experience", async (capability) => {
    const unknown = await view({ capability });
    expect(unknown.main).toBe(main);
    expect(unknown.metadata).toEqual(unfilteredMetadata);
    expect(unknown.metadata.alternates?.canonical).toBe("/experience");
  });

  test("no match here, a match on /projects: the empty state, led by the cross-listing link", async () => {
    const { cards, metadata, main: page } = await view({ capability: "hands-on" });
    const link = crossListing("case-study", ["hands-on"]);
    const projects = projectItems.filter((item) => item.capabilities.includes("hands-on")).length;
    expect(carrying("hands-on")).toEqual([]);
    expect(link?.count).toBe(projects);
    expect(cards).toEqual([]);
    expect(metadata.title).toBe("Experience, no case studies match, Hands-On Engineering");
    expect(metadata.robots).toEqual({ index: false });
    expect(tight(page)).toContain(`Showing 0 of ${caseStudies(total)}, filtered by Hands-On Engineering.`);
    const empty = page.slice(page.indexOf(`<div class="${filterStyles.empty}">`));
    expect(empty.length, "the empty state renders").toBeLessThan(page.length);
    expect(empty, "the cross-listing link is the empty state's first element").toMatch(
      new RegExp(`^<div class="${filterStyles.empty}"><p class="${filterStyles.crossListing}"><a `),
    );
    const links = [...empty.matchAll(/<a [^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/g)].map(([, href, inner]) => ({ href, text: text(inner) }));
    expect(links[0]).toEqual({
      href: "/projects?capability=hands-on#filter-status",
      text: `${projects} ${projects === 1 ? "Project also matches" : "Projects also match"} Hands-On Engineering`,
    });
    expect(links[1]).toEqual({ href: "/experience#filter-status", text: capabilityFilter.showAll });
    expect(text(empty)).toContain(experience.empty);
    // The link sits inside the empty state, not above it as well.
    expect(page.split('href="/projects?capability=hands-on#filter-status"')).toHaveLength(2);
  });

  test("the chips are a list in a named group, plain links, never buttons, no aria-pressed or live region", async () => {
    for (const capability of [undefined, "leadership", "hands-on", "leadership,ai-native,executive-influence,hands-on"]) {
      const { main: page } = await view(capability === undefined ? {} : { capability });
      expect(page).toContain(
        `<div role="group" aria-labelledby="capfilter"><p id="capfilter" class="${filterStyles.label}">${capabilityFilter.groupLabel}</p>`,
      );
      const list = page.match(new RegExp(`<ul class="${filterStyles.chips}">([\\s\\S]*?)</ul>`))?.[1];
      expect(list).toMatch(/^(<li><a [^>]*>[\s\S]*?<\/a><\/li>){4}$/);
      expect(page).not.toMatch(/<ul[^>]*role=|aria-pressed|role="status"|aria-live|<button[\s>]|tabindex/);
      expect(page).toMatch(/<p id="filter-status" class="[^"]*">/);
    }
  });
});
