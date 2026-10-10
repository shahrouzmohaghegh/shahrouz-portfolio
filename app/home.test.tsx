// Home's hero (Stories 2.3 and 2.4). Renders app/page.tsx to static markup
// and checks what a visitor reads above the fold, in order: his name as the
// one h1, the kicker, the positioning statement word for word, the availability line from
// site.availability, then the figure pair's two labels and two figures. Also
// checks the statement stays inside FR-4's 40 to 45 words, that no banned
// word reaches the rendered Home, and that the root layout no longer asks for
// noindex while the empty route shells still do.
//
// The banned words of FR-6 are on the confidential term list, so they are
// never spelled out here: the check reads the untracked .forbidden-terms, as scripts/check-repo.mts does
// (CI restores it before this suite runs), and fails closed without it. A
// failure, including an invalid pattern, names the line number, never the
// term.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";

import { home } from "@/content/home";
import { site } from "@/content/site";
import { caseStudyItems } from "@/lib/evidence";
import { metadata as contactMetadata } from "./contact/page";
import { metadata as experienceMetadata } from "./experience/page";
import { metadata } from "./layout";
import * as homeModule from "./page";
import { metadata as projectsMetadata } from "./projects/page";

const Home = homeModule.default;

const STATEMENT =
  "Engineering leader in regulated industries, most recently running a 38-person function through six people-managers, with a standing seat on the Digital Governance Board, reporting to the CEO. Twenty years across banking, payments and healthcare, hands-on throughout, with AI-native delivery measured rather than assumed.";

const LABELS = ["Bad fixes, Vietnam team, 26 of the 38", "Cycle time, AI-assisted pilot projects"];
const KICKER = "Leadership · Governance · Hands-on";
const DESCRIPTION =
  "Engineering leader in regulated industries: a 38-person function, a Digital Governance Board seat reporting to the CEO, and twenty years across banking, payments and healthcare.";
const FIGURES = ["Over 1 per fix to under 1 in 5", "30 to 40% faster"];

const TERMS_FILE = ".forbidden-terms";

function bannedTerms(): Array<{ line: number; pattern: RegExp }> {
  expect(existsSync(TERMS_FILE), `${TERMS_FILE} is missing, so banned words cannot be checked`).toBe(true);
  return readFileSync(TERMS_FILE, "utf8")
    .split("\n")
    .map((raw, i) => ({ raw: raw.trim(), line: i + 1 }))
    .filter(({ raw }) => raw && !raw.startsWith("#"))
    .map(({ raw, line }) => {
      // A SyntaxError would quote the pattern, which is confidential: name the line only.
      try {
        return { line, pattern: new RegExp(raw, "i") };
      } catch {
        throw new Error(`${TERMS_FILE} line ${line} is not a valid pattern`);
      }
    });
}

const decode = (s: string): string =>
  s
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
const escapeRegExp = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// The PNG IHDR chunk holds width and height as big-endian 32-bit integers at bytes 16 and 20.
function pngSize(path: string): { width: number; height: number } {
  const bytes = readFileSync(path);
  expect(bytes.subarray(12, 16).toString("latin1"), `${path} is a PNG with an IHDR chunk`).toBe("IHDR");
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

const html = renderToStaticMarkup(<>{Home() as ReactNode}</>);
const main = html.slice(html.search(/<main[\s>]/), html.lastIndexOf("</main>"));
// What a visitor or assistive technology can read: text nodes plus alt, aria-label and title.
const text = (fragment: string): string => {
  const attributes = [...fragment.matchAll(/\s(?:alt|aria-label|title)="([^"]*)"/g)].map((m) => m[1]);
  return decode([fragment.replace(/<[^>]*>/g, " "), ...attributes].join(" ")).replace(/\s+/g, " ").trim();
};
const words = (s: string): number => s.trim().split(/\s+/).length;

function positionOf(needle: string, label: string): number {
  const at = main.indexOf(needle);
  expect(at, `Home is missing ${label}: "${needle}"`).toBeGreaterThan(-1);
  return at;
}

describe("the Home hero", () => {
  test('the one h1 is exactly "Shahrouz Mohaghegh", as one text run', () => {
    const h1s = [...html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/g)];
    expect(h1s, "Home has one h1").toHaveLength(1);
    expect(h1s[0][1], "the h1 holds the name and nothing else").toBe("Shahrouz Mohaghegh");
    expect(site.name).toBe("Shahrouz Mohaghegh");
  });

  test("the positioning statement is word for word, 40 to 45 words", () => {
    expect(home.statement).toBe(STATEMENT);
    const count = words(home.statement);
    expect(count, `the statement has ${count} words`).toBeGreaterThanOrEqual(40);
    expect(count, `the statement has ${count} words`).toBeLessThanOrEqual(45);
  });

  test("the kicker reads exactly as reviewed", () => {
    expect(home.kicker).toBe(KICKER);
  });

  test("the hero renders site.availability as its own line, in sentence case", () => {
    expect(site.availability).toBe("Open to conversations about the next role.");
    expect(main).toMatch(new RegExp(`<p[^>]*>${escapeRegExp(site.availability)}</p>`));
  });

  test("name, kicker, statement, availability, labels and figures render in that order", () => {
    const order = [
      positionOf("<h1", "the h1"),
      positionOf(home.kicker, "the kicker"),
      positionOf(STATEMENT, "the positioning statement"),
      positionOf(site.availability, "the availability line"),
      positionOf(LABELS[0], "the first figure-pair label"),
      positionOf(FIGURES[0], "the first figure"),
      positionOf(LABELS[1], "the second figure-pair label"),
      positionOf(FIGURES[1], "the second figure"),
    ];
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });

  test("the figure pair is two rows, each a label above a figure", () => {
    expect(home.figurePair.map((r) => r.label)).toEqual(LABELS);
    expect(home.figurePair.map((r) => r.figure)).toEqual(FIGURES);
  });

  test("the hero has no nameline and no headline", () => {
    // site.positioning belongs to the footer only (sprint change proposal 2026-10-11).
    expect(main).not.toContain(site.positioning);
  });

  test("the portrait is one eager image with its alt and natural size", () => {
    const imgs = [...main.matchAll(/<img\s[^>]*>/g)].map((m) => m[0]);
    expect(imgs).toHaveLength(1);
    expect(imgs[0]).toContain(`alt="${home.portrait.alt}"`);
    expect(imgs[0]).toContain('loading="eager"');
    expect(imgs[0]).toContain('width="1311"');
    expect(imgs[0]).toContain('height="1200"');
    expect(imgs[0]).not.toMatch(/fetchpriority/i);
  });

  test("the portrait file exists at the size the image declares", () => {
    const path = join(process.cwd(), "public", home.portrait.src);
    expect(existsSync(path), `${path} exists`).toBe(true);
    expect(pngSize(path)).toEqual({ width: home.portrait.width, height: home.portrait.height });
  });

  test("the Explore link is a real href to /experience", () => {
    expect(main).toMatch(new RegExp(`<a[^>]*href="/experience"[^>]*>${escapeRegExp(home.explore.label)}`));
  });

  test("the hero never names the Fault Feedback Ratio or DORA", () => {
    // FR-5 as amended 2026-10-11: the metric's name lives in the Quality band
    // and CS-1, and cycle time is never called a DORA metric anywhere.
    const hero = text(main);
    expect(hero).not.toMatch(/fault feedback ratio/i);
    expect(hero).not.toMatch(/\bDORA\b/i);
  });

  test("CS-1's Headline Metric uses the pair's plain words, never the Fault Feedback Ratio name", () => {
    const cs1 = caseStudyItems.find((item) => item.slug === "offshore-delivery-turnaround");
    expect(cs1?.headlineMetric.value).toBe("Bad fixes from over 1 per fix to under 1 in 5");
    expect(cs1?.headlineMetric.value).not.toMatch(/fault feedback ratio/i);
    expect(cs1?.headlineMetric.value.toLowerCase()).toContain(FIGURES[0].toLowerCase());
  });

  test("no banned or confidential term appears anywhere on Home", () => {
    const terms = bannedTerms();
    expect(terms.length, `${TERMS_FILE} holds no terms`).toBeGreaterThan(0);
    const rendered = text(html);
    const hits = terms.filter(({ pattern }) => pattern.test(rendered)).map(({ line }) => line);
    expect(hits, `Home renders the term on these ${TERMS_FILE} lines`).toEqual([]);
  });
});

describe("indexing", () => {
  test("/ asks for no noindex, from the root layout or its own page", () => {
    expect(metadata.robots, "app/layout.tsx metadata has no robots entry").toBeUndefined();
    expect(homeModule.metadata.robots, "app/page.tsx sets no robots").toBeUndefined();
  });

  test("/ carries its meta description, from content/home.ts", () => {
    expect(home.description).toBe(DESCRIPTION);
    expect(homeModule.metadata.description).toBe(home.description);
  });

  test.each([
    ["/experience", experienceMetadata],
    ["/projects", projectsMetadata],
    ["/contact", contactMetadata],
  ])("the empty shell %s asks for noindex, nofollow", (_route, routeMetadata) => {
    expect(routeMetadata.robots).toEqual({ index: false, follow: false });
  });
});
