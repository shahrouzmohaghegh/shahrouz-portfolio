// Home's hero (Stories 2.3 and 2.4). Renders app/page.tsx to static markup
// and checks what a visitor reads above the fold, in order: his name as the
// one h1, the kicker, the positioning statement word for word, the availability line from
// site.availability, then each figure-pair row: number, words, scope. Also
// checks the statement stays inside FR-4's 40 to 45 words, that no banned
// word reaches the rendered Home, and that the root layout no longer asks for
// noindex while the empty route shells still do.
//
// Below the hero (Story 2.5): exactly two evidence bands, Quality on deep then
// Security posture on paper, each one tag, one figure and one caption, each
// carrying the global class `reveal`, sized by Figure demotion. The hero and
// the figure pair are never reveal targets, and RevealOnScroll is the only
// island Home renders.
//
// The banned words of FR-6 are on the confidential term list, so they are
// never spelled out here: the check reads the untracked .forbidden-terms, as scripts/check-repo.mts does
// (CI restores it before this suite runs), and fails closed without it. A
// failure, including an invalid pattern, names the line number, never the
// term.

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";

import bandStyles from "@/components/evidence-band.module.css";
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

// FR-5 as amended 2026-10-11 (C): people first, then speed. Each row is a
// phrase (the number in bold, then what it measures) with its scope beneath.
const ROWS = [
  { figure: "About 35%", words: "of engineers grown into senior or leadership roles", scope: "across the 38-person function" },
  { figure: "30 to 40%", words: "faster cycle time", scope: "across AI-assisted pilot projects" },
];
const KICKER = "Leadership · Governance · Hands-on";
const DESCRIPTION =
  "Engineering leader in regulated industries: a 38-person function, a Digital Governance Board seat reporting to the CEO, and twenty years across banking, payments and healthcare.";

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
// The hero section alone: from its opening tag to its </section> (it nests none).
const heroStart = main.search(/<section[^>]*aria-labelledby="home-name"/);
const hero = main.slice(heroStart, main.indexOf("</section>", heroStart) + "</section>".length);
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

  test("name, kicker, statement, availability, then each row's figure, words and scope, in that order", () => {
    const order = [
      positionOf("<h1", "the h1"),
      positionOf(home.kicker, "the kicker"),
      positionOf(STATEMENT, "the positioning statement"),
      positionOf(site.availability, "the availability line"),
      ...ROWS.flatMap((row, i) => [
        positionOf(row.figure, `row ${i + 1}'s figure`),
        positionOf(row.words, `row ${i + 1}'s words`),
        positionOf(row.scope, `row ${i + 1}'s scope`),
      ]),
    ];
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });

  test("each figure-pair row is a phrase with the number in bold, and the scope beneath it", () => {
    expect(home.figurePair).toEqual(ROWS);
    for (const row of ROWS) {
      const phrase = new RegExp(`<strong[^>]*>${escapeRegExp(row.figure)}</strong>\\s*${escapeRegExp(row.words)}</p>\\s*<p[^>]*>${escapeRegExp(row.scope)}</p>`);
      expect(main, `row "${row.figure}" reads number, words, then scope`).toMatch(phrase);
    }
  });

  test("the figure pair has no caps label", () => {
    expect(readFileSync(join(process.cwd(), "components/figure-pair.module.css"), "utf8")).not.toMatch(/text-transform:\s*uppercase/);
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

  test("the hero never names the Fault Feedback Ratio or bad fixes, and Home never says DORA", () => {
    // FR-5 as amended 2026-10-11: the metric's name lives on the CS-1 page,
    // and cycle time is never called a DORA metric anywhere.
    expect(hero).toContain('id="home-name"');
    expect(text(hero)).not.toMatch(/fault feedback ratio/i);
    expect(text(hero)).not.toMatch(/bad fixes/i);
    expect(text(main)).not.toMatch(/\bDORA\b/i);
  });

  test("CS-1's Headline Metric is the plain-words reduction, never the Fault Feedback Ratio name", () => {
    const cs1 = caseStudyItems.find((item) => item.slug === "offshore-delivery-turnaround");
    expect(cs1?.headlineMetric.value).toBe("Bad fixes cut by more than 80%");
    expect(cs1?.headlineMetric.value).not.toMatch(/fault feedback ratio/i);
  });

  test("no banned or confidential term appears anywhere on Home", () => {
    const terms = bannedTerms();
    expect(terms.length, `${TERMS_FILE} holds no terms`).toBeGreaterThan(0);
    const rendered = text(html);
    const hits = terms.filter(({ pattern }) => pattern.test(rendered)).map(({ line }) => line);
    expect(hits, `Home renders the term on these ${TERMS_FILE} lines`).toEqual([]);
  });
});

const BANDS = [
  {
    tone: "deep",
    tag: "Cloud delivery",
    figure: "8 weeks",
    role: "figure",
    caption:
      "Reporting service moved from the on-premise data centre to Azure, with no disruption to the 3,000 pharmacies and 200+ aged care homes it serves.",
  },
  {
    tone: "paper",
    tag: "Security posture",
    figure: "Secure Score from 20% to 76%",
    role: "figure-small",
    caption:
      "Microsoft Defender for Cloud Secure Score across the full production Azure subscription, reported to the Digital Governance Board.",
  },
] as const;

const classesOf = (tag: string): string[] => (tag.match(/\sclass="([^"]*)"/)?.[1] ?? "").split(/\s+/).filter(Boolean);
// Every opening tag on Home carrying the global class `reveal`, nested or
// not, with the markup up to the next </section> (sections never nest here).
const revealTargets = [...main.matchAll(/<\w+(?:\s[^>]*)?>/g)]
  .filter((m) => classesOf(m[0]).includes("reveal"))
  .map((m) => {
    const start = (m.index ?? 0) + m[0].length;
    return { open: m[0], inner: main.slice(start, main.indexOf("</section>", start)) };
  });
const BAND_INNER =
  /^<h2 id="([^"]*)" class="([^"]*)">([^<]*)<\/h2><p class="([^"]*)" data-figure-role="([\w-]+)">([^<]*)<\/p><p class="([^"]*)">([^<]*)<\/p>$/;

describe("the evidence bands below the hero", () => {
  test("content/home.ts holds exactly the two reviewed bands, in order", () => {
    expect(home.bands.map(({ tone, tag, figure, caption }) => ({ tone, tag, figure, caption }))).toEqual(
      BANDS.map(({ tone, tag, figure, caption }) => ({ tone, tag, figure, caption })),
    );
  });

  test("exactly two reveal targets render, both bands, Cloud delivery then Security posture", () => {
    expect(revealTargets, "Home has two reveal targets").toHaveLength(2);
    revealTargets.forEach(({ open, inner }, i) => {
      const band = BANDS[i];
      expect(open.startsWith("<section"), `band ${band.tag} is a section`).toBe(true);
      expect(classesOf(open), `band ${band.tag} is on ${band.tone}`).toContain(bandStyles[band.tone]);
      const parts = inner.match(BAND_INNER);
      expect(parts, `band ${band.tag} holds one tag, one figure and one caption, nothing else`).not.toBeNull();
      const [, headingId, tagClass, tag, figureClass, role, figure, captionClass, caption] = parts ?? [];
      expect(open, `band ${band.tag} is named by its h2`).toContain(`aria-labelledby="${headingId}"`);
      expect(headingId).not.toBe("");
      expect([tagClass, figureClass, captionClass]).toEqual([bandStyles.tag, bandStyles.figure, bandStyles.caption]);
      expect(decode(tag), `band ${band.tag}: tag`).toBe(band.tag);
      expect(decode(figure), `band ${band.tag}: figure`).toBe(band.figure);
      expect(role, `band ${band.tag}: figure role by Figure demotion`).toBe(band.role);
      expect(decode(caption), `band ${band.tag}: caption`).toBe(band.caption);
    });
  });

  test("headings run one h1, then the two band h2s, in order", () => {
    const headings = [...html.matchAll(/<(h[1-6])[^>]*>([\s\S]*?)<\/\1>/g)].map((m) => `${m[1]} ${decode(m[2])}`);
    expect(headings).toEqual([`h1 ${site.name}`, ...BANDS.map((band) => `h2 ${band.tag}`)]);
  });

  test("both bands come after the figure pair and the Explore link", () => {
    const explore = positionOf(home.explore.label, "the Explore link");
    expect(explore).toBeGreaterThan(positionOf(ROWS[1].scope, "the second row's scope"));
    const cloud = main.indexOf(`>${BANDS[0].tag}</h2>`);
    const security = main.indexOf(`>${BANDS[1].tag}</h2>`);
    expect(cloud, "Cloud delivery band").toBeGreaterThan(explore);
    expect(security, "Security posture band").toBeGreaterThan(cloud);
  });

  test("Home never shows the Fault Feedback Ratio or its per-fix ratio", () => {
    // The ratio and its definition live on the CS-1 page only (Shahrouz, PR #19 review).
    expect(text(main)).not.toMatch(/fault feedback ratio/i);
    expect(text(main)).not.toMatch(/per fix/i);
  });

  test("the hero and the figure pair are never reveal targets", () => {
    expect(hero).not.toMatch(/class="[^"]*\breveal\b/);
  });

  test("the Secure Score figure appears once on Home, in its band", () => {
    expect(main.split(BANDS[1].figure)).toHaveLength(2);
  });
});

describe("islands on Home", () => {
  const ISLANDS_DIR = join(process.cwd(), "components", "islands");
  const source = (path: string): string => readFileSync(join(process.cwd(), path), "utf8");
  // Every module specifier: import ... from, export ... from, bare import and import().
  const specifiers = (code: string): string[] =>
    [...code.matchAll(/\b(?:import|export)\s[^;]*?\bfrom\s*["']([^"']+)["']|\bimport\s*["']([^"']+)["']|\bimport\s*\(\s*["']([^"']+)["']/g)].map(
      (m) => m[1] ?? m[2] ?? m[3],
    );
  // "use client" counts after any leading comments and blank lines.
  const isClient = (code: string): boolean =>
    /^["']use client["']/.test(code.replace(/^(?:\s+|\/\/[^\n]*\n?|\/\*[\s\S]*?\*\/)*/, ""));

  test("the specifier and directive readers see every form", () => {
    expect(specifiers('export { X } from "a/islands/x";\nconst y = import("b/islands/y");\nimport "c";')).toEqual([
      "a/islands/x",
      "b/islands/y",
      "c",
    ]);
    expect(isClient('// note\n/* block */\n\n"use client";\n')).toBe(true);
    expect(isClient('const a = "use client";\n')).toBe(false);
  });

  test("Home and the components it renders reach no island but RevealOnScroll", () => {
    const islands = ["app/page.tsx", "components/home-hero.tsx", "components/evidence-band.tsx"].flatMap((path) =>
      specifiers(source(path)).filter((specifier) => /(^|\/)islands\//.test(specifier)),
    );
    expect(islands).toEqual(["@/components/islands/reveal-on-scroll"]);
    expect(source("app/page.tsx")).toMatch(/<RevealOnScroll\s*\/>/);
  });

  test("no component outside components/islands/ is a client component", () => {
    const sources = (dir: string): string[] =>
      readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) return path === ISLANDS_DIR ? [] : sources(path);
        return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [path] : [];
      });
    const clients = [...sources(join(process.cwd(), "components")), ...sources(join(process.cwd(), "app"))].filter((path) =>
      isClient(readFileSync(path, "utf8")),
    );
    expect(clients).toEqual([]);
  });

  test("the island imports no content and no other island", () => {
    expect(specifiers(source("components/islands/reveal-on-scroll.tsx"))).toEqual(["react"]);
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
