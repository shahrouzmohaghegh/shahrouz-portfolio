// The /experience listing (Story 3.1). Renders app/experience/page.tsx to
// static markup and checks what a visitor reads: the h1, the one intro line
// from content/experience.ts, then one evidence card per case study in
// collection order, each an article with an h2 title link and the CTA to its
// href, so the headings run h1 then one h2 per card. A mocked collection with
// an item added or removed changes the card count, which proves the route
// follows lib/evidence with no edit to the page. The title comes from
// listingTitle in lib/evidence, for /projects too, and the root template adds
// the site name once. The listing asks for no noindex, is static, hydrates no
// island and has no filter yet (Epic 4). Static markup is what a visitor with
// JavaScript off gets, so every card and link is checked there.

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";

import gridStyles from "@/components/card-grid.module.css";
import cardStyles from "@/components/evidence-card.module.css";
import { metricSentence } from "@/components/evidence-card";
import { experience } from "@/content/experience";
import { CAPABILITY_NAME, caseStudyItems, listingTitle, type EvidenceItem } from "@/lib/evidence";
import { metadata as rootMetadata } from "../layout";
import { metadata as projectsMetadata } from "../projects/page";
import * as experienceModule from "./page";

const ExperiencePage = experienceModule.default;

const decode = (s: string): string =>
  s
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
const escapeRegExp = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const text = (fragment: string): string => decode(fragment.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
const source = (path: string): string => readFileSync(join(process.cwd(), path), "utf8");

const render = (page: () => unknown): string => renderToStaticMarkup(<>{page() as ReactNode}</>);
const mainOf = (html: string): string => html.slice(html.search(/<main[\s>]/), html.lastIndexOf("</main>"));
const cardsIn = (fragment: string): string[] => fragment.split("<article").slice(1).map((card) => card.slice(0, card.indexOf("</article>")));

const html = render(ExperiencePage);
const main = mainOf(html);

describe("the /experience listing", () => {
  test("content/experience.ts holds the reviewed words", () => {
    expect(experience).toEqual({
      heading: "Experience",
      description:
        "Case studies in engineering leadership: an offshore delivery turnaround, AI-native engineering measured across pilot projects, and a standing seat on the Digital Governance Board.",
      intro: "Work from regulated healthcare, each with the decisions behind it, what they cost, and the measured outcome.",
      cta: "Read the case study",
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
    expect(main.split(`<ul class="${gridStyles.grid}">`), "one card grid").toHaveLength(2);
    expect(main.split(`<li class="${gridStyles.item}"><article`), "one grid item per card").toHaveLength(caseStudyItems.length + 1);
  });

  test("no chips, state line, filter, cross-listing link or project yet (Epic 4)", () => {
    expect(main).not.toMatch(/role="status"|aria-current="true"|capability=/);
    expect(main).not.toMatch(/href="\/projects/);
    expect(main).not.toMatch(/<form[\s>]|<input[\s>]|<button[\s>]/);
  });

  test("app/experience/page.tsx passes the collection to the shared grid and lists no item itself", () => {
    const page = source("app/experience/page.tsx");
    expect(page).toMatch(/<CardGrid\s+items=\{caseStudyItems\}/);
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
      const cards = cardsIn(mainOf(render(mocked.default)));
      const expected = change(caseStudyItems);
      expect(cards).toHaveLength(expected.length);
      expect(cards.map((card) => card.match(/href="([^"]*)"/)?.[1])).toEqual(expected.map((item) => item.href));
    } finally {
      vi.doUnmock("@/lib/evidence");
      vi.resetModules();
    }
  });
});

describe("the listing titles", () => {
  const template = (rootMetadata.title as { template: string }).template;

  test("/experience and /projects take metadata.title from listingTitle", () => {
    expect(experienceModule.metadata.title).toBe(listingTitle("case-study"));
    expect(projectsMetadata.title).toBe(listingTitle("project"));
  });

  test("the h1 and the title name the listing the same way", () => {
    expect(experience.heading).toBe(listingTitle("case-study"));
  });

  test("the root template renders each with the site name once", () => {
    expect(template.replace("%s", String(experienceModule.metadata.title))).toBe("Experience | Shahrouz Mohaghegh");
    expect(template.replace("%s", String(projectsMetadata.title))).toBe("Projects | Shahrouz Mohaghegh");
  });

  test("neither route composes its own title", () => {
    for (const path of ["app/experience/page.tsx", "app/projects/page.tsx"]) {
      expect(source(path), path).toMatch(/title:\s*listingTitle\("(case-study|project)"\)/);
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

  test("/experience asks for no noindex", () => {
    expect(experienceModule.metadata.robots).toBeUndefined();
  });

  test("/experience carries its meta description, from content/experience.ts", () => {
    expect(experienceModule.metadata.description).toBe(experience.description);
  });

  test("the route stays static: no search params, no dynamic rendering", () => {
    const page = source("app/experience/page.tsx");
    expect(page).not.toMatch(/searchParams|export const dynamic|cookies\(|headers\(/);
  });

  test("the route and the components it renders reach no island", () => {
    const islands = ["app/experience/page.tsx", "components/card-grid.tsx", "components/evidence-card.tsx"].flatMap((path) =>
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
