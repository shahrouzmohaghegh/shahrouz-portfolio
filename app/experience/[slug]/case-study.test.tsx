// The case-study detail route (Story 3.2). Every MDX file is empty until
// Story 3.3, so the route is tested against a mocked collection: two or three
// real case studies treated as written, each with a fixture body of the five
// <Section> blocks. Static markup is what a visitor with JavaScript off gets,
// so the rail, the sections and the next link are all checked there. The
// rail's script (one aria-current, focus on activation) is tested in
// components/islands/section-rail.test.ts.
//
// Matrix (spec I/O table): a written slug renders the header, a rail of five,
// the sections in order and the next link; an empty or unknown slug calls
// notFound(), which serves this segment's not-found page with a 404; the last
// written item's next link wraps to the first; one written item has no next
// link. Malformed MDX is the integrity suite's (lib/evidence.test.ts).

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, test, vi } from "vitest";

import { Section } from "@/components/mdx-section";
import { caseStudyPage } from "@/content/case-study-page";
import { useMDXComponents } from "@/mdx-components";
import { CAPABILITY_NAME, CASE_STUDY_SECTIONS, caseStudyItems } from "@/lib/evidence";
import { metadata as rootMetadata } from "../../layout";

// Which real case studies the mock treats as written; each test sets it.
const state = vi.hoisted(() => ({ written: [] as string[] }));

vi.mock("@/lib/evidence", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/evidence")>();
  return {
    ...actual,
    writtenCaseStudyItems: () => actual.caseStudyItems.filter((item) => state.written.includes(item.slug)),
    // The fixture body: the five sections in order, as a written MDX holds
    // them. Section is imported on call, not in this factory, because it
    // imports this mocked module itself.
    caseStudyBody: async () => {
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

const [first, second, third] = caseStudyItems;
const params = (slug: string) => ({ params: Promise.resolve({ slug }) });

const decode = (s: string): string =>
  s.replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
const text = (fragment: string): string => decode(fragment.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
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
});

describe("a written case study", () => {
  test("renders the header: the eyebrow, the h1 title, then the summary as dek", async () => {
    state.written = [first.slug, second.slug];
    const main = mainOf(await renderPage(first.slug));
    const header = main.slice(0, main.indexOf("</header>"));
    const eyebrows = [...header.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/g)].map((m) => text(m[1]));
    expect(eyebrows).toEqual([caseStudyPage.eyebrow, ...first.capabilities.map((c) => CAPABILITY_NAME[c])]);
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

describe("an unwritten or unknown case study", () => {
  test("only written case studies are generated", () => {
    state.written = [];
    expect(route.generateStaticParams()).toEqual([]);
    state.written = [first.slug, third.slug];
    expect(route.generateStaticParams()).toEqual([{ slug: first.slug }, { slug: third.slug }]);
  });

  test("an empty MDX is not found, page and metadata alike", async () => {
    state.written = [first.slug];
    await expectNotFound(() => renderPage(second.slug));
    await expectNotFound(() => route.generateMetadata(params(second.slug)));
  });

  test("an unknown slug is not found", async () => {
    state.written = [first.slug];
    await expectNotFound(() => renderPage("nope"));
  });

  test("an ungenerated slug reaches the page, so notFound() serves this segment's not-found page", () => {
    // dynamicParams = false would answer it with the root app/not-found.tsx instead.
    expect("dynamicParams" in route).toBe(false);
  });

  test("the not-found page: the h1, one sentence, then Experience, Projects and Home", () => {
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

