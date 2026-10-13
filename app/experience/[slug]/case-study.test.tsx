// The case-study detail route (Story 3.2). The route is tested against a
// mocked collection: two or three real case studies treated as written, each
// with a fixture body of the five <Section> blocks, so the route's behaviour
// does not depend on the prose. The written case studies (Story 3.3) are
// then rendered for real: each .mdx is compiled with @mdx-js/mdx, the
// compiler @next/mdx runs at build, through the real mdx-components.tsx, and
// the whole page is checked for confidentiality, structure, FR-33 and FR-34. Static markup is what a visitor with JavaScript off gets,
// so the rail, the sections and the next link are all checked there. The
// rail's script (one aria-current, focus on activation) is tested in
// components/islands/section-rail.test.ts.
//
// Matrix (spec I/O table): a written slug renders the header, a rail of five,
// the sections in order and the next link; the last written item's next link
// wraps to the first; one written item has no next link. An empty or unknown
// slug is answered by proxy.ts first, with the static
// app/case-study-not-available page and a 404 (lib/not-found-rewrite.test.ts
// covers the rewrite; this suite covers the page). Should one reach this route
// anyway, the page calls notFound() as the fallback, serving this segment's
// not-found.tsx. Malformed MDX is the integrity suite's (lib/evidence.test.ts).

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { evaluate } from "@mdx-js/mdx";
import type { MDXContent } from "mdx/types";
import type { ReactNode } from "react";
import * as runtime from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, test, vi } from "vitest";

import kvStyles from "@/components/case-study/key-value-list.module.css";
import noteStyles from "@/components/case-study/source-note.module.css";
import { Section } from "@/components/mdx-section";
import { caseStudyPage } from "@/content/case-study-page";
import { useMDXComponents } from "@/mdx-components";
import { CAPABILITY_NAME, CASE_STUDY_SECTIONS, caseStudyItems } from "@/lib/evidence";
import { metadata as rootMetadata } from "../../layout";

// Which real case studies the mock treats as written; each test sets it.
// A slug in `bodies` renders its real compiled MDX instead of the fixture.
const state = vi.hoisted(() => ({ written: [] as string[], bodies: {} as Record<string, unknown> }));

vi.mock("@/lib/evidence", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/evidence")>();
  return {
    ...actual,
    writtenCaseStudyItems: () => actual.caseStudyItems.filter((item) => state.written.includes(item.slug)),
    // The fixture body: the five sections in order, as a written MDX holds
    // them. Section is imported on call, not in this factory, because it
    // imports this mocked module itself.
    caseStudyBody: async (slug: string) => {
      if (slug in state.bodies) return state.bodies[slug];
      const { Section: FixtureSection } = await import("@/components/mdx-section");
      const { createElement } = await import("react");
      return () =>
        createElement(
          "div",
          null,
          ...actual.CASE_STUDY_SECTIONS.map(({ id }) => createElement(FixtureSection, { key: id, name: id }, createElement("p", null, `Fixture ${id}.`))),
        );
    },
  };
});

const route = await import("./page");
const NotFoundPage = (await import("./not-found")).default;
const target = await import("../../case-study-not-available/page");

const [first, second, third] = caseStudyItems;
const params = (slug: string) => ({ params: Promise.resolve({ slug }) });

const decode = (s: string): string =>
  s.replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
const text = (fragment: string): string => decode(fragment.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
// The hrefs the Primary nav marks with aria-current.
const primaryCurrent = (html: string): string[] => {
  const nav = html.match(/<nav [^>]*aria-label="Primary"[^>]*>([\s\S]*?)<\/nav>/)?.[1] ?? "";
  return [...nav.matchAll(/<a ([^>]*)>/g)].filter(([, attrs]) => /aria-current=/.test(attrs)).map(([, attrs]) => attrs.match(/href="([^"]*)"/)?.[1] ?? "");
};
const mainOf = (html: string): string => html.slice(html.search(/<main[\s>]/), html.lastIndexOf("</main>"));
const source = (path: string): string => readFileSync(join(process.cwd(), path), "utf8");

async function renderPage(slug: string): Promise<string> {
  const element = (await route.default(params(slug))) as ReactNode;
  return renderToStaticMarkup(<>{element}</>);
}

// notFound() throws an error whose digest marks a 404 for the nearest not-found boundary.
async function expectNotFound(run: () => Promise<unknown>): Promise<void> {
  await expect(run()).rejects.toMatchObject({ digest: expect.stringMatching(/^NEXT_HTTP_ERROR_FALLBACK;404/) });
}

afterEach(() => {
  state.written = [];
  state.bodies = {};
});

describe("a written case study", () => {
  test("renders the header: the eyebrow, the h1 title, then the summary as dek", async () => {
    state.written = [first.slug, second.slug];
    const main = mainOf(await renderPage(first.slug));
    const header = main.slice(0, main.indexOf("</header>"));
    // "Case study" is its own element before the list, so the list holds the capabilities only.
    expect(header).toMatch(new RegExp(`<p[^>]*>${caseStudyPage.eyebrow}</p><ul`));
    const eyebrows = [...header.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/g)].map((m) => text(m[1]));
    expect(eyebrows).toEqual(first.capabilities.map((c) => CAPABILITY_NAME[c]));
    expect(header).toMatch(new RegExp(`<h1[^>]*>${first.title}</h1>`));
    expect(decode(header)).toContain(`>${first.summary}</p>`);
    expect(header.indexOf("<h1")).toBeLessThan(header.indexOf(first.summary.slice(0, 20)));
  });

  test("renders the rail inside main: the label, then five in-page anchors in section order", async () => {
    state.written = [first.slug];
    const main = mainOf(await renderPage(first.slug));
    const rail = main.match(/<nav [^>]*aria-label="Sections of this case study"[^>]*>([\s\S]*?)<\/nav>/)?.[1] ?? "";
    expect(caseStudyPage.railAriaLabel).toBe("Sections of this case study");
    expect(text(rail)).toMatch(new RegExp(`^${caseStudyPage.railLabel}`));
    const anchors = [...rail.matchAll(/<a [^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/g)].map((m) => [m[1], text(m[2])]);
    expect(anchors).toEqual(CASE_STUDY_SECTIONS.map(({ id, label }) => [`#${id}`, label]));
  });

  test("renders the five sections in order, each a focusable target labelled by its h2", async () => {
    state.written = [first.slug];
    const main = mainOf(await renderPage(first.slug));
    const sections = [...main.matchAll(/<section ([^>]*)><h2 ([^>]*)>([^<]*)<\/h2>/g)].map((m) => ({ attrs: m[1], h2: m[2], label: m[3] }));
    expect(sections.map((s) => s.label)).toEqual(CASE_STUDY_SECTIONS.map((s) => s.label));
    sections.forEach(({ attrs, h2 }, i) => {
      const { id } = CASE_STUDY_SECTIONS[i];
      expect(attrs).toContain(`id="${id}"`);
      expect(attrs).toContain('tabindex="-1"');
      const labelledBy = attrs.match(/aria-labelledby="([^"]*)"/)?.[1];
      expect(h2).toContain(`id="${labelledBy}"`);
    });
    for (const { id } of CASE_STUDY_SECTIONS) expect(main).toContain(`Fixture ${id}.`);
  });

  test("headings run the h1, then one h2 per section, with no level skipped", async () => {
    state.written = [first.slug];
    const main = mainOf(await renderPage(first.slug));
    const headings = [...main.matchAll(/<(h[1-6])[^>]*>([\s\S]*?)<\/\1>/g)].map((m) => `${m[1]} ${text(m[2])}`);
    expect(headings).toEqual([`h1 ${first.title}`, ...CASE_STUDY_SECTIONS.map((s) => `h2 ${s.label}`)]);
  });

  test("the rail comes before the body, and with JavaScript off no anchor is current", async () => {
    state.written = [first.slug];
    const main = mainOf(await renderPage(first.slug));
    expect(main.indexOf('aria-label="Sections of this case study"')).toBeLessThan(main.indexOf('<section id="context"'));
    expect(main).not.toContain("aria-current");
  });

  test("links to the next written case study in collection order", async () => {
    state.written = [first.slug, third.slug];
    const main = mainOf(await renderPage(first.slug));
    const next = [...main.matchAll(/<a [^>]*href="(\/experience\/[^"]*)"[^>]*>([\s\S]*?)<\/a>/g)].map((m) => [m[1], text(m[2])]);
    expect(next).toEqual([[third.href, `${caseStudyPage.nextLabel}: ${third.title}`]]);
  });

  test("the last written case study's next link wraps to the first", async () => {
    state.written = [first.slug, second.slug, third.slug];
    const main = mainOf(await renderPage(third.slug));
    expect(main).toMatch(new RegExp(`<a [^>]*href="${first.href}"`));
    expect(text(main)).toContain(`${caseStudyPage.nextLabel}: ${first.title}`);
  });

  test("with only one case study written there is no next link", async () => {
    state.written = [second.slug];
    const main = mainOf(await renderPage(second.slug));
    expect(main).not.toMatch(/href="\/experience\//);
    expect(text(main)).not.toContain(caseStudyPage.nextLabel);
  });

  test("the primary nav marks Experience as the current item", async () => {
    state.written = [first.slug];
    expect(primaryCurrent(await renderPage(first.slug))).toEqual(["/experience"]);
  });

  test("the title is the item's title, with the site name added once by the root template, and the description its summary", async () => {
    state.written = [first.slug];
    const metadata = await route.generateMetadata(params(first.slug));
    const template = (rootMetadata.title as { template: string }).template;
    expect(metadata.title).toBe(first.title);
    expect(template.replace("%s", String(metadata.title))).toBe(`${first.title} | Shahrouz Mohaghegh`);
    expect(metadata.description).toBe(first.summary);
    expect(metadata.robots).toBeUndefined();
  });
});

// The fallback: proxy.ts answers these slugs before the route is reached.
describe("an unwritten or unknown case study that reaches the route", () => {
  test("only written case studies are generated", () => {
    state.written = [];
    expect(route.generateStaticParams()).toEqual([]);
    state.written = [first.slug, third.slug];
    expect(route.generateStaticParams()).toEqual([{ slug: first.slug }, { slug: third.slug }]);
  });

  test("an empty MDX falls back to notFound(), page and metadata alike", async () => {
    state.written = [first.slug];
    await expectNotFound(() => renderPage(second.slug));
    await expectNotFound(() => route.generateMetadata(params(second.slug)));
  });

  test("an unknown slug falls back to notFound()", async () => {
    state.written = [first.slug];
    await expectNotFound(() => renderPage("nope"));
  });

  test("the fallback keeps dynamicParams at its default, so notFound() serves this segment's not-found page", () => {
    // dynamicParams = false would answer it with the root app/not-found.tsx instead.
    expect("dynamicParams" in route).toBe(false);
  });

  test("the fallback not-found page: the h1, one sentence, then Experience, Projects and Home", () => {
    const main = mainOf(renderToStaticMarkup(<NotFoundPage />));
    expect(main).toMatch(/<h1[^>]*>This case study is not available\.<\/h1>/);
    expect(main).toMatch(/<p[^>]*>The page may have moved, or the link may be incomplete\.<\/p>/);
    const links = [...main.matchAll(/<a [^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/g)].map((m) => [m[1], text(m[2])]);
    expect(links).toEqual([
      ["/experience", "Experience"],
      ["/projects", "Projects"],
      ["/", "Home"],
    ]);
    expect(main).not.toMatch(/<form[\s>]|<input[\s>]|<h2[\s>]/);
  });
});

// What proxy.ts serves, with status 404, for an unwritten or unknown slug:
// the same treatment as not-found.tsx, as static HTML, kept out of search.
describe("the static case-study not-found page", () => {
  const main = mainOf(renderToStaticMarkup(<target.default />));

  test("renders the same h1, sentence and three links as not-found.tsx", () => {
    expect(main).toBe(mainOf(renderToStaticMarkup(<NotFoundPage />)));
    expect(main).toMatch(/<h1[^>]*>This case study is not available\.<\/h1>/);
  });

  test("marks no primary nav item as current", () => {
    expect(primaryCurrent(renderToStaticMarkup(<target.default />))).toEqual([]);
  });

  test("keeps the tab title and asks for noindex", () => {
    expect(target.metadata.title).toBe(caseStudyPage.notFound.title);
    expect(caseStudyPage.notFound.title).toBe("Case study not available");
    expect(target.metadata.robots).toEqual({ index: false });
  });

  test("is static: it reads no params, search params or request", () => {
    expect(source("app/case-study-not-available/page.tsx")).not.toMatch(/params|searchParams|cookies\(|headers\(|export const dynamic/);
  });
});

describe("how the route is built", () => {
  // Every module specifier: import ... from, export ... from, bare import and import().
  const specifiers = (code: string): string[] =>
    [...code.matchAll(/\b(?:import|export)\s[^;]*?\bfrom\s*["']([^"']+)["']|\bimport\s*["']([^"']+)["']|\bimport\s*\(\s*["']([^"']+)["']/g)].map(
      (m) => m[1] ?? m[2] ?? m[3],
    );

  test("the page reaches one island, SectionRail, and the not-found page none", () => {
    const islands = (path: string) => specifiers(source(path)).filter((s) => /(^|\/)islands\//.test(s));
    expect(islands("app/experience/[slug]/page.tsx")).toEqual(["@/components/islands/section-rail"]);
    expect(islands("app/experience/[slug]/not-found.tsx")).toEqual([]);
    expect(islands("components/detail-not-found.tsx")).toEqual([]);
    expect(islands("components/mdx-section.tsx")).toEqual([]);
  });

  test("SectionRail imports no content and no other island", () => {
    const imports = specifiers(source("components/islands/section-rail.tsx"));
    expect(imports.filter((s) => /content\/|islands\/|reveal-on-scroll/.test(s))).toEqual([]);
  });

  test("the islands directory holds exactly the two registered islands", () => {
    const files = readdirSync(join(process.cwd(), "components/islands")).filter((f) => /\.tsx?$/.test(f) && !/\.test\./.test(f));
    expect(files.sort()).toEqual(["reveal-on-scroll.tsx", "section-rail.tsx"]);
  });

  test("MDX gets Section from mdx-components.tsx, so the prose imports nothing", () => {
    expect(useMDXComponents().Section).toBe(Section);
  });

  test("the page and its not-found page take their words from content/case-study-page.ts", () => {
    for (const path of ["app/experience/[slug]/page.tsx", "app/experience/[slug]/not-found.tsx"]) {
      expect(specifiers(source(path)), path).toContain("@/content/case-study-page");
    }
  });

  test("a section name outside the five fails loudly", () => {
    expect(() => renderToStaticMarkup(<Section name="appendix" />)).toThrow(/not a case-study section/);
  });
});


// The written case studies (Story 3.3), rendered for real. Each .mdx is
// compiled by @mdx-js/mdx, the compiler @next/mdx runs at build, with the
// real mdx-components.tsx, and rendered inside the real page, so what is
// checked here is the HTML a visitor with JavaScript off receives. The build
// itself (three generated pages) is checked on `npm run build` and
// `next start`.
describe("the written case studies, rendered", async () => {
  const actual = await vi.importActual<typeof import("@/lib/evidence")>("@/lib/evidence");
  const written = actual.writtenCaseStudyItems();
  const slugs = written.map((item) => item.slug);
  const mdxPath = (slug: string) => `content/case-studies/${slug}.mdx`;
  const compile = async (slug: string): Promise<MDXContent> =>
    (await evaluate(source(mdxPath(slug)), { ...runtime, useMDXComponents })).default;
  const bodies = Object.fromEntries(await Promise.all(slugs.map(async (slug) => [slug, await compile(slug)] as const)));

  async function renderWritten(slug: string): Promise<string> {
    state.written = [...slugs];
    state.bodies = bodies;
    return renderPage(slug);
  }
  // From the first section to the end of the last: the case study's own prose.
  const bodyOf = (main: string): string => main.slice(main.indexOf("<section"), main.lastIndexOf("</section>") + "</section>".length);
  const sectionOf = (main: string, id: string): string => {
    const at = main.indexOf(`<section id="${id}"`);
    return main.slice(at, main.indexOf("</section>", at));
  };
  // Text with each block element on its own line, so sentences never run across blocks.
  const blocks = (html: string): string[] =>
    decode(html.replace(/<\/(p|li|dd|dt|h[1-6]|blockquote|div)>/g, "\n").replace(/<[^>]*>/g, " "))
      .split("\n")
      .map((line) => line.replace(/\s+/g, " ").trim())
      .filter(Boolean);
  const sentences = (html: string): string[] => blocks(html).flatMap((block) => block.split(/(?<=\.)\s+(?=[A-Z[])/));
  // Everything a reader or a screen reader can get: text plus alt, aria-label, title and href values.
  const readable = (html: string): string =>
    [text(html), ...[...html.matchAll(/\s(?:alt|aria-label|title|href)="([^"]*)"/g)].map((m) => decode(m[1]))].join("\n");

  test("all three case studies are written, in collection order", () => {
    expect(slugs).toEqual(caseStudyItems.map((item) => item.slug));
  });

  describe.each(slugs)("%s", (slug) => {
    test("renders the header, the rail of five, then the five sections in order, each through the real components", async () => {
      const main = mainOf(await renderWritten(slug));
      const headings = [...main.matchAll(/<(h[12])[^>]*>([\s\S]*?)<\/\1>/g)].map((m) => `${m[1]} ${text(m[2])}`);
      expect(headings).toEqual([`h1 ${caseStudyItems.find((each) => each.slug === slug)?.title}`, ...CASE_STUDY_SECTIONS.map((s) => `h2 ${s.label}`)]);
      // No heading level is skipped: any h3 sits inside a section, under its h2.
      expect(main).not.toMatch(/<h[4-6][\s>]/);
      const rail = main.match(/<nav [^>]*aria-label="Sections of this case study"[^>]*>([\s\S]*?)<\/nav>/)?.[1] ?? "";
      expect([...rail.matchAll(/href="(#[^"]*)"/g)].map((m) => m[1])).toEqual(CASE_STUDY_SECTIONS.map(({ id }) => `#${id}`));
      expect(main).not.toContain("Fixture");
    });

    test("Decisions sets out each decision as a labelled trade-off pair", async () => {
      const decisions = sectionOf(mainOf(await renderWritten(slug)), "decisions");
      const items = [...decisions.matchAll(/<li[^>]*><h3[^>]*>/g)];
      expect(items.length).toBeGreaterThan(0);
      expect(decisions.split(`>${caseStudyPage.tradeoff.buys}<`).length - 1).toBe(items.length);
      expect(decisions.split(`>${caseStudyPage.tradeoff.costs}<`).length - 1).toBe(items.length);
    });

    test("Outcome states a result in the outcome band, then a source note and a key-value list", async () => {
      const outcome = sectionOf(mainOf(await renderWritten(slug)), "outcome");
      const band = outcome.search(/data-figure-role="/);
      const note = outcome.indexOf(`class="${noteStyles.note}"`);
      const kv = outcome.indexOf(`class="${kvStyles.list}"`);
      expect(band, "an outcome band").toBeGreaterThan(-1);
      expect(note, "a source note after the band").toBeGreaterThan(band);
      expect(kv, "a key-value list after the source note").toBeGreaterThan(note);
    });

    test("Lessons has something to say", async () => {
      const lessons = sectionOf(mainOf(await renderWritten(slug)), "lessons");
      expect(text(lessons.replace(/<h2[\s\S]*?<\/h2>/, "")).length).toBeGreaterThan(0);
    });

    test("the key-value list repeats every number the page states", async () => {
      const body = bodyOf(mainOf(await renderWritten(slug)));
      const kvAt = body.indexOf(`class="${kvStyles.list}"`);
      const kv = body.slice(kvAt, body.indexOf("</dl>", kvAt));
      const numbers = (html: string) => new Set(text(html).match(/\d+(?:\.\d+)?/g) ?? []);
      const listed = numbers(kv);
      expect([...numbers(body)].filter((n) => !listed.has(n))).toEqual([]);
    });

    test("no confidential term, em dash, Team Lead, CIO or board peer title reaches the page or its source", async () => {
      const html = await renderWritten(slug);
      const page = readable(mainOf(html)) + "\n" + readable(html.match(/<head>([\s\S]*?)<\/head>/)?.[1] ?? "");
      const hits: string[] = [];
      for (const { line, pattern } of confidentialTerms()) {
        if (pattern.test(page)) hits.push(`${slug} (rendered): matches ${TERMS_FILE} line ${line}`);
        source(mdxPath(slug)).split("\n").forEach((text, i) => {
          if (pattern.test(text)) hits.push(`${mdxPath(slug)}:${i + 1}: matches ${TERMS_FILE} line ${line}`);
        });
      }
      for (const [name, pattern] of EXTRA_BANNED) {
        if (pattern.test(page)) hits.push(`${slug} (rendered): ${name}`);
        source(mdxPath(slug)).split("\n").forEach((text, i) => {
          if (pattern.test(text)) hits.push(`${mdxPath(slug)}:${i + 1}: ${name}`);
        });
      }
      expect(hits).toEqual([]);
    });

    // FR-34: a percentage never stands without its scope and its source in the same sentence.
    test("every percentage carries its scope and source in the same sentence", async () => {
      const body = bodyOf(mainOf(await renderWritten(slug)));
      const [scope, from] = FIGURE_CONTEXT[slug] ?? [/$^/, /$^/];
      const bare = sentences(body).filter((sentence) => /\d%/.test(sentence) && !(scope.test(sentence) && from.test(sentence)));
      expect(bare).toEqual([]);
    });

    test("every [I'll supply: ...] marker has been filled by Shahrouz (red until he fills them)", () => {
      const open = source(mdxPath(slug))
        .split("\n")
        .flatMap((line, i) => (MARKER.test(line) ? [`${mdxPath(slug)}:${i + 1}`] : []));
      expect(open, "Shahrouz fills each marker himself; never fill one by inference").toEqual([]);
    });
  });

  test("no [I'll supply: ...] marker is left in the case-study metadata", () => {
    const path = "content/case-studies/index.ts";
    const open = source(path)
      .split("\n")
      .flatMap((line, i) => (MARKER.test(line) ? [`${path}:${i + 1}`] : []));
    expect(open).toEqual([]);
  });

  test("the metadata files carry no confidential term, em dash, Team Lead, CIO or board peer title", () => {
    const hits: string[] = [];
    for (const path of ["content/case-studies/index.ts", "content/case-study-page.ts"]) {
      source(path).split("\n").forEach((text, i) => {
        for (const { line, pattern } of confidentialTerms()) if (pattern.test(text)) hits.push(`${path}:${i + 1}: matches ${TERMS_FILE} line ${line}`);
        for (const [name, pattern] of EXTRA_BANNED) if (pattern.test(text)) hits.push(`${path}:${i + 1}: ${name}`);
      });
    }
    expect(hits).toEqual([]);
  });

  // FR-33: on the AI-native case study the measured outcome comes before any
  // AI vocabulary, read across the whole of main, header included. One named
  // allowance: the page title (the h1) and the capability name (an eyebrow)
  // are labels, not claims, so they are left out. The dek is not: it may use
  // AI vocabulary only after a measured figure of its own.
  test("AI-native engineering states its measured outcome before any AI vocabulary", async () => {
    const item = caseStudyItems.find((each) => each.slug === "ai-native-engineering");
    const main = mainOf(await renderWritten("ai-native-engineering"));
    const labels = main
      .replace(/<h1[^>]*>[\s\S]*?<\/h1>/, "")
      .replace(/<li[^>]*>([^<]*)<\/li>/g, (whole, label: string) =>
        Object.values(CAPABILITY_NAME).includes(decode(label) as (typeof CAPABILITY_NAME)[keyof typeof CAPABILITY_NAME]) ? "" : whole,
      );
    const page = text(labels);
    const outcome = page.search(MEASURED);
    const vocabulary = page.search(AI_VOCABULARY);
    expect(outcome).toBeGreaterThan(-1);
    expect(vocabulary === -1 || outcome < vocabulary, `AI vocabulary first: "${page.slice(vocabulary, vocabulary + 40)}"`).toBe(true);
    const dek = item?.summary ?? "";
    const dekVocabulary = dek.search(AI_VOCABULARY);
    const dekFigure = dek.search(MEASURED);
    expect(dekVocabulary === -1 || (dekFigure > -1 && dekFigure < dekVocabulary), `the dek uses AI vocabulary before a figure: "${dek}"`).toBe(true);
  });

  test("\"Ralph loop\" never appears without a plain-language gloss straight after it", async () => {
    for (const slug of slugs) {
      const body = text(bodyOf(mainOf(await renderWritten(slug))));
      for (const match of body.matchAll(/Ralph loops?/gi)) {
        expect(body.slice((match.index ?? 0) + match[0].length), slug).toMatch(/^ \([^)]{12,}\)/);
      }
    }
  });
});

// The confidential terms (.forbidden-terms, untracked; CI writes it from a
// secret). A pattern is never quoted in a failure: only its line number.
const TERMS_FILE = ".forbidden-terms";
function confidentialTerms(): Array<{ line: number; pattern: RegExp }> {
  expect(existsSync(TERMS_FILE), `${TERMS_FILE} is missing, so confidential terms cannot be checked`).toBe(true);
  const terms = readFileSync(TERMS_FILE, "utf8")
    .split("\n")
    .map((raw, i) => ({ raw: raw.trim(), line: i + 1 }))
    .filter(({ raw }) => raw && !raw.startsWith("#"))
    .map(({ raw, line }) => {
      try {
        return { line, pattern: new RegExp(raw, "i") };
      } catch {
        throw new Error(`${TERMS_FILE} line ${line} is not a valid pattern`);
      }
    });
  expect(terms.length, `${TERMS_FILE} holds no terms, so confidential terms cannot be checked`).toBeGreaterThan(0);
  return terms;
}

// What the confidentiality rule bans beyond the terms file: the em dash, the
// internal title, any CIO, the board peers by title (one more is in the
// terms file, so it is not named here), and any departure.
const EXTRA_BANNED: ReadonlyArray<readonly [string, RegExp]> = [
  ["em dash", new RegExp(String.fromCharCode(0x2014))],
  ["Team Lead", /\bteam leads?\b/i],
  ["CIO", /\bCIO\b/i],
  [
    "board peer title",
    /\b(CFO|CTO|COO|CISO)\b|\bhead of (operations|security)\b|\bchief (financial|technology|operating|information security|information|digital( and information)?) officer\b/i,
  ],
  ["Secure Score", /\bsecure score\b/i],
  ["a departure", /\b(resigned|managed out|let (him|her|them) go|was fired|were fired|departure|departed)\b/i],
];

// The scope and the source each percentage must share a sentence with.
const FIGURE_CONTEXT: Record<string, readonly [RegExp, RegExp]> = {
  "offshore-delivery-turnaround": [/Vietnam team/, /Fault Feedback Ratio/],
  "ai-native-engineering": [/pilot projects/, /workflow|survey/],
};

// An unfilled marker, with a straight or a curly apostrophe.
const MARKER = /\[I['\u2019]ll supply/;

// A measured figure: a range or a single percentage.
const MEASURED = /\d+ to \d+%|\d+%/;

const AI_VOCABULARY = /\bAI\b|\bagent|\bLLM|\bmodels?\b|\bretrieval\b|\bvector\b|\bRalph\b|\bprompt|\bmachine learning\b|\bartificial intelligence\b/i;
