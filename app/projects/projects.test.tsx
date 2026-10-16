// The projects routes (Story 3.5): the /projects listing and the
// /projects/<slug> detail. The listing renders the real collection. The
// detail is tested against a mocked collection: real projects treated as
// written, each with a fixture body of the eight <Section> blocks, so the
// route's behaviour does not depend on prose that Story 3.7 writes. Any
// project that is written for real is then compiled with @mdx-js/mdx (the
// compiler @next/mdx runs at build) through the real mdx-components.tsx and
// checked for structure, confidentiality and the Python rule. Static markup
// is what a visitor with JavaScript off gets, so the rail, the sections, the
// repository link and the next link are all checked there; the rail's script
// is tested in components/islands/section-rail.test.ts.
//
// Matrix (spec I/O table): the listing has the h1, the intro and one h2 card
// per project in collection order with "Read the project", and no noindex
// unfiltered. Filtered (Epic 4), it shows the union, asks for noindex, and
// when nothing matches (Leadership or Executive Influence at launch) shows
// the empty state led by the link to the matching case studies.
// A written project renders the header, the repository call to action when
// it has a repository (and none when it has not), a rail of eight under
// three group headers with the repository repeated at its foot, the eight
// sections and the next link. An unwritten or unknown slug is answered by
// proxy.ts first with the static app/project-not-available page and a 404
// (lib/not-found-rewrite.test.ts covers the rewrite; this suite covers the
// page). Malformed MDX is the integrity suite's (lib/evidence.test.ts).
// Python listed beside C#, C++, SQL, KQL or TypeScript fails. The
// repository call to action's classes appear on no other route.

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { evaluate } from "@mdx-js/mdx";
import type { MDXContent } from "mdx/types";
import type { ComponentType, ReactNode } from "react";
import * as runtime from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, test, vi } from "vitest";

import kvStyles from "@/components/case-study/key-value-list.module.css";
import noteStyles from "@/components/case-study/source-note.module.css";
import gridStyles from "@/components/card-grid.module.css";
import cardStyles from "@/components/evidence-card.module.css";
import { metricSentence } from "@/components/evidence-card";
import repoStyles from "@/components/repo-cta.module.css";
import { repoCtaName } from "@/components/repo-cta";
import { caseStudyPage } from "@/content/case-study-page";
import { projectPage } from "@/content/project-page";
import filterStyles from "@/components/capability-filter.module.css";
import { capabilityFilter } from "@/content/capability-filter";
import { projectsPage } from "@/content/projects-page";
import { useMDXComponents } from "@/mdx-components";
import {
  CAPABILITY_NAME,
  PROJECT_SECTION_GROUPS,
  PROJECT_SECTIONS,
  caseStudyItems,
  joinCapabilityNames,
  listingHref,
  listingTitle,
  parseSelection,
  projectItems,
  type EvidenceItem,
  type EvidenceKind,
} from "@/lib/evidence";
import { metadata as rootMetadata } from "../layout";

// Which real projects the mock treats as written; each test sets it. A slug
// in `bodies` renders that body instead of the fixture. The first case study
// is always treated as written, so the accent-scope check can render a case
// study too.
const state = vi.hoisted(() => ({ written: [] as string[], bodies: {} as Record<string, unknown> }));

vi.mock("@/lib/evidence", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/evidence")>();
  return {
    ...actual,
    writtenItems: (kind: EvidenceKind) =>
      kind === "project" ? actual.projectItems.filter((item) => state.written.includes(item.slug)) : actual.caseStudyItems.slice(0, 1),
    // The fixture body: the kind's sections in order, as a written MDX holds
    // them. Section is imported on call, because it imports this module.
    evidenceBody: async (kind: EvidenceKind, slug: string) => {
      if (slug in state.bodies) return state.bodies[slug];
      const { Section: FixtureSection } = await import("@/components/mdx-section");
      const { createElement } = await import("react");
      return () =>
        createElement(
          "div",
          null,
          ...actual.sectionsOf(kind).map(({ id }) => createElement(FixtureSection, { key: id, name: id }, createElement("p", null, `Fixture ${id}.`))),
        );
    },
  };
});

const listing = await import("./page");
const route = await import("./[slug]/page");
const NotFoundPage = (await import("./[slug]/not-found")).default;
const target = await import("../project-not-available/page");

const byslug = (slug: string): EvidenceItem => {
  const item = projectItems.find((each) => each.slug === slug);
  if (item === undefined) throw new Error(`no project ${slug}`);
  return item;
};
const pr1 = byslug("career-application-system");
const pr2 = byslug("this-website");
const pr3 = byslug("platform-modernisation");
const params = (slug: string) => ({ params: Promise.resolve({ slug }) });

const decode = (s: string): string =>
  s.replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
const escapeRegExp = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const text = (fragment: string): string => decode(fragment.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
const primaryCurrent = (html: string): string[] => {
  const nav = html.match(/<nav [^>]*aria-label="Primary"[^>]*>([\s\S]*?)<\/nav>/)?.[1] ?? "";
  return [...nav.matchAll(/<a ([^>]*)>/g)].filter(([, attrs]) => /aria-current=/.test(attrs)).map(([, attrs]) => attrs.match(/href="([^"]*)"/)?.[1] ?? "");
};
const mainOf = (html: string): string => html.slice(html.search(/<main[\s>]/), html.lastIndexOf("</main>"));
const source = (path: string): string => readFileSync(join(process.cwd(), path), "utf8");
const cardsIn = (fragment: string): string[] => fragment.split("<article").slice(1).map((card) => card.slice(0, card.indexOf("</article>")));
// Every anchor: its attributes and its inner HTML.
const anchors = (html: string): Array<{ attrs: string; inner: string }> =>
  [...html.matchAll(/<a ([^>]*)>([\s\S]*?)<\/a>/g)].map((m) => ({ attrs: m[1], inner: m[2] }));
const attr = (attrs: string, name: string): string | undefined => attrs.match(new RegExp(`\\b${name}="([^"]*)"`))?.[1];
// Every module specifier: import ... from, export ... from, bare import and import().
const specifiers = (code: string): string[] =>
  [...code.matchAll(/\b(?:import|export)\s[^;]*?\bfrom\s*["']([^"']+)["']|\bimport\s*["']([^"']+)["']|\bimport\s*\(\s*["']([^"']+)["']/g)].map(
    (m) => m[1] ?? m[2] ?? m[3],
  );

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

type SearchParams = Record<string, string | string[] | undefined>;
const listingProps = (searchParams: SearchParams = {}) => ({ searchParams: Promise.resolve(searchParams) });
const renderListing = async (searchParams: SearchParams = {}): Promise<string> =>
  renderToStaticMarkup(<>{(await listing.default(listingProps(searchParams))) as ReactNode}</>);
const listingMetadata = (searchParams: SearchParams = {}) => listing.generateMetadata(listingProps(searchParams));

describe("the /projects listing", async () => {
  const html = await renderListing();
  const main = mainOf(html);
  const metadata = await listingMetadata();

  test("content/projects-page.ts holds the reviewed words", () => {
    expect(projectsPage).toEqual({
      heading: "Projects",
      description:
        "Projects in hands-on engineering: a governed multi-agent system, this website, and platform modernisation through agentic loops.",
      intro: "Systems I built, each with the decisions behind it, what they cost, and how they were tested.",
      cta: "Read the project",
      empty: "The projects are systems I built. Leadership and stakeholder influence are told through the case studies, on Experience.",
    });
  });

  test("the h1 comes first, then the intro line, then the cards", () => {
    const h1 = main.search(new RegExp(`<h1[^>]*>${escapeRegExp(projectsPage.heading)}</h1>`));
    const intro = main.search(new RegExp(`<p[^>]*>${escapeRegExp(projectsPage.intro)}</p>`));
    expect(h1, "the h1 renders").toBeGreaterThan(-1);
    expect(intro, "the intro renders after the h1").toBeGreaterThan(h1);
    expect(main.indexOf("<article"), "the cards render after the intro").toBeGreaterThan(intro);
  });

  test("one card per project, in collection order, each complete, with the CTA Read the project", () => {
    const cards = cardsIn(main);
    expect(cards, "one card per project").toHaveLength(projectItems.length);
    cards.forEach((card, i) => {
      const item = projectItems[i];
      const hrefs = [...card.matchAll(/<a [^>]*href="([^"]*)"/g)].map((m) => m[1]);
      expect(hrefs, `${item.slug}: title and CTA link to its page`).toEqual([item.href, item.href]);
      expect(card, `${item.slug}: linked h2 title`).toMatch(new RegExp(`<h2[^>]*><a [^>]*>${escapeRegExp(item.title)}</a></h2>`));
      for (const capability of item.capabilities) expect(text(card), `${item.slug}: eyebrow`).toContain(CAPABILITY_NAME[capability]);
      expect(decode(card), `${item.slug}: metric with its qualifier`).toContain(`>${metricSentence(item)}</p>`);
      expect(text(card), `${item.slug}: CTA`).toMatch(/Read the project$/);
      expect(card, `${item.slug}: card styles`).toContain(`class="${cardStyles.metric}"`);
    });
  });

  test("headings run the h1, then one h2 per card", () => {
    const headings = [...html.matchAll(/<(h[1-6])[^>]*>([\s\S]*?)<\/\1>/g)].map((m) => `${m[1]} ${text(m[2])}`);
    expect(headings).toEqual([`h1 ${projectsPage.heading}`, ...projectItems.map((item) => `h2 ${item.title}`)]);
  });

  test("the cards sit in the shared card grid, and the route lists no item itself", () => {
    expect(main.split(`<ul class="${gridStyles.grid}" data-card-grid="">`)).toHaveLength(2);
    const page = source("app/projects/page.tsx");
    expect(page).toMatch(/<FilteredListing\s+kind="project"\s+selection=\{selection\}\s+items=\{projectItems\}/);
    expect(source("components/capability-filter.tsx")).toMatch(/<CardGrid\s+items=\{shown\}[^>]*headingLevel=\{2\}/);
    for (const item of projectItems) expect(page).not.toContain(item.slug);
  });

  test("unfiltered: no chip selected, no live region or form control, and no repository link on the listing", () => {
    expect(main).not.toMatch(/role="status"|aria-live|aria-pressed|aria-current="true"/);
    expect(main).not.toMatch(/<form[\s>]|<input[\s>]|<button[\s>]/);
    expect(main).not.toMatch(/github\.com/);
    expect(main).toContain(`href="/experience#filter-status"`);
  });

  test("the primary nav marks Projects as current", () => {
    expect(primaryCurrent(html)).toEqual(["/projects"]);
  });

  test("the title comes from listingTitle, the description from content, and there is no noindex", () => {
    expect(metadata.title).toBe(listingTitle("project"));
    expect(metadata.description).toBe(projectsPage.description);
    expect(metadata.robots).toBeUndefined();
  });

  test("the route renders dynamically from search params, through lib/evidence only, and reaches no island", () => {
    const page = source("app/projects/page.tsx");
    expect(page).toMatch(/selectionFrom\(await searchParams\)/);
    expect(page).not.toMatch(/export const dynamic|cookies\(|headers\(|generateStaticParams|\.capability\b|\[["']capability["']\]/);
    expect(specifiers(page).filter((s) => /(^|\/)islands\//.test(s))).toEqual([]);
  });

  // Counts are read from the collections, never written in.
  const total = projectItems.length;
  const projectsNoun = (count: number) => `${count} ${count === 1 ? "project" : "projects"}`;
  const carrying = (items: readonly EvidenceItem[], selection: readonly string[]) =>
    items.filter((item) => item.capabilities.some((c) => selection.includes(c)));

  test("filtered: the union of the selection, a counted title, noindex and its canonical URL", async () => {
    const filtered = await listingMetadata({ capability: "ai-native,hands-on" });
    const expected = carrying(projectItems, ["ai-native", "hands-on"]);
    expect(cardsIn(mainOf(await renderListing({ capability: "ai-native,hands-on" })))).toHaveLength(expected.length);
    expect(filtered.title).toBe(`Projects, ${expected.length} of ${projectsNoun(total)}, AI-Native Engineering or Hands-On Engineering`);
    expect(filtered.robots).toEqual({ index: false });
    expect(filtered.alternates?.canonical).toBe("/projects?capability=ai-native,hands-on");
    const one = await listingMetadata({ capability: "ai-native" });
    expect(one.title).toBe(`Projects, ${carrying(projectItems, ["ai-native"]).length} of ${projectsNoun(total)}, AI-Native Engineering`);
  });

  test.each([
    [{ capability: "zzz" }, "/projects"],
    [{ capability: "" }, "/projects"],
    [{}, "/projects"],
    [{ capability: "Hands-On,AI-NATIVE,hands-on" }, "/projects?capability=ai-native,hands-on"],
  ])("%j has the canonical URL %s", async (searchParams, canonical) => {
    expect((await listingMetadata(searchParams)).alternates?.canonical).toBe(canonical);
  });

  test.each([["leadership"], ["executive-influence"], ["executive-influence,leadership"]])(
    "%s matches no project: the empty state, led by the link to Experience",
    async (capability) => {
      const selection = parseSelection(capability);
      const names = joinCapabilityNames(selection);
      const page = mainOf(await renderListing({ capability }));
      expect(carrying(projectItems, selection)).toEqual([]);
      expect(cardsIn(page)).toEqual([]);
      expect((await listingMetadata({ capability })).title).toBe(`Projects, no projects match, ${joinCapabilityNames(selection, " or ")}`);
      const empty = page.slice(page.indexOf(`<div class="${filterStyles.empty}">`));
      expect(empty).toMatch(new RegExp(`^<div class="${filterStyles.empty}"><p class="${filterStyles.crossListing}"><a `));
      const links = anchors(empty).map(({ attrs, inner }) => ({ href: decode(attr(attrs, "href") ?? ""), text: text(inner) }));
      const count = carrying(caseStudyItems, selection).length;
      const sentence = `${count} ${count === 1 ? "case study also matches" : "case studies also match"} ${names}`;
      expect(links[0]).toEqual({ href: `${listingHref("case-study", selection)}#filter-status`, text: sentence });
      expect(links[1]).toEqual({ href: "/projects#filter-status", text: capabilityFilter.showAll });
      expect(text(empty)).toContain(projectsPage.empty);
      expect(page).not.toMatch(/aria-pressed|role="status"|aria-live|<button[\s>]|tabindex/);
    },
  );
});

describe("a written project", () => {
  test("renders the header: the eyebrow Project, the capabilities, the h1 title, then the summary as dek", async () => {
    state.written = [pr1.slug, pr2.slug];
    const main = mainOf(await renderPage(pr1.slug));
    const header = main.slice(0, main.indexOf("</header>"));
    expect(projectPage.eyebrow).toBe("Project");
    expect(header).toMatch(/<p[^>]*>Project<\/p><ul/);
    const eyebrows = [...header.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/g)].map((m) => text(m[1]));
    expect(eyebrows).toEqual(pr1.capabilities.map((c) => CAPABILITY_NAME[c]));
    expect(header).toMatch(new RegExp(`<h1[^>]*>${escapeRegExp(pr1.title)}</h1>`));
    expect(decode(header)).toContain(`>${pr1.summary}</p>`);
  });

  test("the repository call to action follows the dek: one anchor, accent panel, the full URL as visible text", async () => {
    state.written = [pr1.slug];
    const main = mainOf(await renderPage(pr1.slug));
    const header = main.slice(0, main.indexOf("</header>"));
    const panel = anchors(header).filter(({ attrs }) => attr(attrs, "class") === repoStyles.panel);
    expect(panel).toHaveLength(1);
    const [{ attrs, inner }] = panel;
    expect(attr(attrs, "href")).toBe(pr1.repository);
    expect(inner, "the panel holds no second link").not.toMatch(/<a[\s>]/);
    expect(text(inner)).toBe(`Repository Open the repository on GitHub ${pr1.repository}`);
    expect(decode(attr(attrs, "aria-label") ?? "")).toBe(repoCtaName(projectPage.repository.kicker, projectPage.repository.title, pr1.repository ?? ""));
    expect(decode(header).indexOf(pr1.summary)).toBeLessThan(header.indexOf(repoStyles.panel));
  });

  test("the rail repeats it at its foot, with the same href and the same accessible name", async () => {
    state.written = [pr2.slug];
    const main = mainOf(await renderPage(pr2.slug));
    const rail = main.match(/<nav [^>]*aria-label="Sections of this project"[^>]*>([\s\S]*?)<\/nav>/)?.[1] ?? "";
    const repeats = anchors(rail).filter(({ attrs }) => attr(attrs, "class") === repoStyles.rail);
    expect(repeats).toHaveLength(1);
    expect(rail.indexOf(repoStyles.rail)).toBeGreaterThan(rail.lastIndexOf("</ol>"));
    const repository = anchors(main).filter(({ attrs }) => attr(attrs, "href") === pr2.repository);
    expect(repository.map(({ attrs }) => attr(attrs, "class"))).toEqual([repoStyles.panel, repoStyles.rail]);
    expect(new Set(repository.map(({ attrs }) => attr(attrs, "aria-label"))).size).toBe(1);
    // The accessible name holds the visible words in order, so speech input can use them.
    expect(text(repeats[0].inner)).toContain(projectPage.repository.title);
    const words = (s: string) => s.toLowerCase().replace(/[^a-z0-9/.:-]+/g, " ").replace(/[:()]/g, " ").replace(/\s+/g, " ").trim();
    expect(words(decode(attr(repeats[0].attrs, "aria-label") ?? ""))).toContain(words(text(repeats[0].inner)));
  });

  test("a project without a repository renders no call to action, in the header or the rail", async () => {
    state.written = [pr3.slug];
    expect(pr3.repository).toBeUndefined();
    const main = mainOf(await renderPage(pr3.slug));
    expect(main).not.toContain(repoStyles.panel);
    expect(main).not.toContain(repoStyles.rail);
    expect(main).not.toMatch(/github\.com/);
  });

  test("renders the rail: the label, then eight anchors numbered on through three group headers", async () => {
    state.written = [pr1.slug];
    const main = mainOf(await renderPage(pr1.slug));
    const rail = main.match(/<nav [^>]*aria-label="Sections of this project"[^>]*>([\s\S]*?)<\/nav>/)?.[1] ?? "";
    expect(projectPage.railAriaLabel).toBe("Sections of this project");
    const parts = [...rail.matchAll(/<p [^>]*>([^<]*)<\/p>|<a [^>]*href="(#[^"]*)"[^>]*>([\s\S]*?)<\/a>/g)].map((m) =>
      m[1] !== undefined ? `p ${m[1]}` : `${m[2]} ${text(m[3])}`,
    );
    expect(parts).toEqual([
      `p ${projectPage.railLabel}`,
      ...PROJECT_SECTION_GROUPS.flatMap((group) => [`p ${group.label}`, ...group.sections.map(({ id, label }) => `#${id} ${label}`)]),
    ]);
    expect(PROJECT_SECTION_GROUPS.map((group) => group.label)).toEqual(["The build", "How it held up", "What came of it"]);
  });

  test("renders the eight sections in order, each a focusable target labelled by its h2", async () => {
    state.written = [pr1.slug];
    const main = mainOf(await renderPage(pr1.slug));
    const sections = [...main.matchAll(/<section ([^>]*)><h2 ([^>]*)>([^<]*)<\/h2>/g)].map((m) => ({ attrs: m[1], label: m[3] }));
    expect(sections.map((s) => s.label)).toEqual(PROJECT_SECTIONS.map((s) => s.label));
    sections.forEach(({ attrs }, i) => {
      expect(attrs).toContain(`id="${PROJECT_SECTIONS[i].id}"`);
      expect(attrs).toContain('tabindex="-1"');
    });
  });

  test("headings run the h1, then one h2 per section: the group headers are not headings", async () => {
    state.written = [pr1.slug];
    const main = mainOf(await renderPage(pr1.slug));
    const headings = [...main.matchAll(/<(h[1-6])[^>]*>([\s\S]*?)<\/\1>/g)].map((m) => `${m[1]} ${text(m[2])}`);
    expect(headings).toEqual([`h1 ${pr1.title}`, ...PROJECT_SECTIONS.map((s) => `h2 ${s.label}`)]);
  });

  test("the panel, then the rail, then the body, and with JavaScript off no anchor is current", async () => {
    state.written = [pr1.slug];
    const main = mainOf(await renderPage(pr1.slug));
    const order = [main.indexOf(repoStyles.panel), main.indexOf('aria-label="Sections of this project"'), main.indexOf('<section id="problem"')];
    expect(order.every((at) => at > -1)).toBe(true);
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(main).not.toContain("aria-current");
  });

  test("links to the next written project, wrapping from the last to the first", async () => {
    state.written = [pr1.slug, pr3.slug];
    const nextOf = async (slug: string) =>
      anchors(mainOf(await renderPage(slug)))
        .filter(({ attrs }) => /^\/projects\//.test(attr(attrs, "href") ?? ""))
        .map(({ attrs, inner }) => [attr(attrs, "href"), text(inner)]);
    expect(await nextOf(pr1.slug)).toEqual([[pr3.href, `Next project: ${pr3.title}`]]);
    expect(await nextOf(pr3.slug)).toEqual([[pr1.href, `Next project: ${pr1.title}`]]);
  });

  test("with only one project written there is no next link", async () => {
    state.written = [pr2.slug];
    const main = mainOf(await renderPage(pr2.slug));
    expect(main).not.toMatch(/href="\/projects\//);
    expect(text(main)).not.toContain(projectPage.nextLabel);
  });

  test("the primary nav marks Projects as the current item", async () => {
    state.written = [pr1.slug];
    expect(primaryCurrent(await renderPage(pr1.slug))).toEqual(["/projects"]);
  });

  test("the title is the item's title, with the site name added once, and the description its summary", async () => {
    state.written = [pr1.slug];
    const metadata = await route.generateMetadata(params(pr1.slug));
    const template = (rootMetadata.title as { template: string }).template;
    expect(metadata.title).toBe(pr1.title);
    expect(template.replace("%s", String(metadata.title))).toBe(`${pr1.title} | Shahrouz Mohaghegh`);
    expect(metadata.description).toBe(pr1.summary);
    expect(metadata.robots).toBeUndefined();
  });
});

describe("an unwritten or unknown project that reaches the route", () => {
  test("only written projects are generated", () => {
    expect(route.generateStaticParams()).toEqual([]);
    state.written = [pr1.slug, pr3.slug];
    expect(route.generateStaticParams()).toEqual([{ slug: pr1.slug }, { slug: pr3.slug }]);
  });

  test("an unwritten slug falls back to notFound(), page and metadata alike, and so does an unknown one", async () => {
    state.written = [pr1.slug];
    await expectNotFound(() => renderPage(pr2.slug));
    await expectNotFound(() => route.generateMetadata(params(pr2.slug)));
    await expectNotFound(() => renderPage("nope"));
  });

  test("a case study's slug is not a project, even on the written list", async () => {
    state.written = [caseStudyItems[0].slug, pr1.slug];
    await expectNotFound(() => renderPage(caseStudyItems[0].slug));
    await expectNotFound(() => route.generateMetadata(params(caseStudyItems[0].slug)));
  });

  test("the fallback keeps dynamicParams at its default, so notFound() serves this segment's not-found page", () => {
    expect("dynamicParams" in route).toBe(false);
  });

  test("the fallback not-found page: the h1, one sentence, then Projects, Experience and Home", () => {
    const main = mainOf(renderToStaticMarkup(<NotFoundPage />));
    expect(main).toMatch(/<h1[^>]*>This project is not available\.<\/h1>/);
    expect(main).toMatch(/<p[^>]*>The page may have moved, or the link may be incomplete\.<\/p>/);
    const links = anchors(main).map(({ attrs, inner }) => [attr(attrs, "href"), text(inner)]);
    expect(links).toEqual([
      ["/projects", "Projects"],
      ["/experience", "Experience"],
      ["/", "Home"],
    ]);
    expect(main).not.toMatch(/<form[\s>]|<input[\s>]|<h2[\s>]/);
  });
});

describe("the static project not-found page", () => {
  const html = renderToStaticMarkup(<target.default />);

  test("renders the same h1, sentence and three links as not-found.tsx", () => {
    expect(mainOf(html)).toBe(mainOf(renderToStaticMarkup(<NotFoundPage />)));
  });

  test("marks no primary nav item as current", () => {
    expect(primaryCurrent(html)).toEqual([]);
  });

  test("keeps the tab title and asks for noindex", () => {
    expect(target.metadata.title).toBe("Project not available");
    expect(target.metadata.robots).toEqual({ index: false });
  });

  test("is static: it reads no params, search params or request", () => {
    expect(source("app/project-not-available/page.tsx")).not.toMatch(/params|searchParams|cookies\(|headers\(|export const dynamic/);
  });
});

describe("how the routes are built", () => {
  test("the detail page reaches one island, SectionRail; the listing and not-found pages none", () => {
    const islands = (path: string) => specifiers(source(path)).filter((s) => /(^|\/)islands\//.test(s));
    expect(islands("app/projects/[slug]/page.tsx")).toEqual(["@/components/islands/section-rail"]);
    for (const path of ["app/projects/page.tsx", "app/projects/[slug]/not-found.tsx", "app/project-not-available/page.tsx", "components/repo-cta.tsx"]) {
      expect(islands(path), path).toEqual([]);
    }
  });

  test("the islands directory still holds exactly the two registered islands", () => {
    const files = readdirSync(join(process.cwd(), "components/islands")).filter((f) => /\.tsx?$/.test(f) && !/\.test\./.test(f));
    expect(files.sort()).toEqual(["reveal-on-scroll.tsx", "section-rail.tsx"]);
  });

  test("the pages take their words from content/, and RepoCta is not an MDX component", () => {
    for (const path of ["app/projects/[slug]/page.tsx", "app/projects/[slug]/not-found.tsx", "app/project-not-available/page.tsx"]) {
      expect(specifiers(source(path)), path).toContain("@/content/project-page");
    }
    expect(specifiers(source("app/projects/page.tsx"))).toContain("@/content/projects-page");
    expect(Object.keys(useMDXComponents())).not.toContain("RepoCta");
  });

  // Story 3.7 wrote all three projects: the committed list names each, in
  // collection order, and the route generates exactly those three pages.
  test("with all three projects on the committed written list, exactly their three pages are generated", async () => {
    const actual = await vi.importActual<typeof import("@/lib/evidence")>("@/lib/evidence");
    const committed = actual.writtenItems("project").map((item) => item.slug);
    expect(committed).toEqual([pr1.slug, pr2.slug, pr3.slug]);
    state.written = committed;
    expect(route.generateStaticParams()).toEqual(committed.map((slug) => ({ slug })));
  });
});

// The repository call to action is the one solid accent fill on the site,
// allowed on /projects/[slug] only (DESIGN.md, the named accent exemption).
// Every other route is rendered, and none may carry its classes.
describe("accent scope", () => {
  const APP_DIR = join(process.cwd(), "app");
  const ROUTE_FILE = /^(page|not-found)\.tsx$/;
  const files = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) return files(path);
      return ROUTE_FILE.test(entry.name) ? [path] : [];
    });
  const routes = files(APP_DIR).map((file) => relative(APP_DIR, file));
  const others = routes.filter((file) => file !== join("projects", "[slug]", "page.tsx"));
  // Every class the stylesheet defines, as the CSS module names it.
  const classes = [...new Set([...source("components/repo-cta.module.css").matchAll(/^\.([A-Za-z]+)/gm)].map((m) => m[1]))].map(
    (name) => (repoStyles as Record<string, string>)[name],
  );

  async function render(file: string): Promise<string> {
    const { default: Page } = (await import(join(APP_DIR, file))) as { default: ComponentType<Record<string, unknown>> };
    const segments = file.split(sep);
    const slug = segments.includes("[slug]") ? (segments[0] === "projects" ? pr1.slug : caseStudyItems[0].slug) : undefined;
    const props = { params: Promise.resolve(slug === undefined ? {} : { slug }), searchParams: Promise.resolve({}) };
    const element = (await (Page as (p: typeof props) => ReactNode | Promise<ReactNode>)(props)) as ReactNode;
    return renderToStaticMarkup(<>{element}</>);
  }

  test("finds every route, including the project ones", () => {
    expect(routes).toEqual(
      expect.arrayContaining(["page.tsx", join("projects", "page.tsx"), join("project-not-available", "page.tsx"), join("experience", "[slug]", "page.tsx")]),
    );
    expect(classes).toEqual(expect.arrayContaining([repoStyles.panel, repoStyles.rail, repoStyles.url]));
  });

  test.each(others)("%s renders no repository call-to-action class", async (file) => {
    state.written = [pr1.slug];
    const html = await render(file);
    expect(classes.filter((name) => html.includes(name))).toEqual([]);
  });

  test("the project detail renders them, so the check above can see them", async () => {
    state.written = [pr1.slug];
    const html = await render(join("projects", "[slug]", "page.tsx"));
    expect(html).toContain(repoStyles.panel);
    expect(html).toContain(repoStyles.rail);
  });

  test("only the project detail page imports the repository call to action", () => {
    // Every source file under app/ (pages, layouts, templates, not-found
    // pages) and components/, and mdx-components.tsx, which would hand it to
    // every MDX file.
    const under = (dir: string): string[] =>
      readdirSync(join(process.cwd(), dir), { recursive: true, encoding: "utf8" }).map((file) => join(dir, file));
    const sources = [...under("app"), ...under("components"), "mdx-components.tsx"].filter(
      (file) => /\.tsx?$/.test(file) && !/\.test\./.test(file),
    );
    expect(sources).toEqual(expect.arrayContaining([join("app", "layout.tsx"), "mdx-components.tsx"]));
    const users = sources
      .filter((file) => specifiers(source(file)).some((s) => /(^|\/)repo-cta$/.test(s)))
      .map((file) => file.split(sep).join("/"));
    expect(users).toEqual(["app/projects/[slug]/page.tsx"]);
  });

  test("below 768px the rail repeat is hidden, so the link does not appear twice in a row", () => {
    const css = source("components/repo-cta.module.css");
    // The rail variant's own rule (after the rule it shares with the panel) sets its display from the pair.
    const rules = [...css.matchAll(/(?:^|\n)\.rail \{([^}]*)\}/g)].map((m) => m[1]);
    expect(rules.at(-1)).toMatch(/display:\s*var\(--component-repo-cta-rail-display\);/);
    expect(source("styles/tokens.css")).toMatch(/--component-repo-cta-rail-display-mobile:\s*none;/);
    expect(source("styles/tokens.css")).toMatch(/--component-repo-cta-rail-display:\s*block;/);
    expect(source("styles/breakpoints.css")).toMatch(
      /--component-repo-cta-rail-display:\s*var\(--component-repo-cta-rail-display-mobile\);/,
    );
  });

  test("both variants keep the paper focus ring, set on themselves", () => {
    const css = source("components/repo-cta.module.css");
    expect(css).toMatch(/\.panel,\s*\.rail\s*\{[^}]*--focus-ring:\s*var\(--color-focus-ring\);/);
    expect(css).toMatch(/background:\s*var\(--color-accent\);/);
    expect(css).toMatch(/color:\s*var\(--color-on-accent\);/);
    expect(css).not.toMatch(/outline/);
  });
});

// Python is never listed as peer depth with C#, C++, SQL, KQL or TypeScript
// (Epic 3, projects). Story 3.7 writes the Technologies sections; this is the
// check that guards them. The rule is section-wide: when a Technologies
// section names Python (Python3 included) anywhere and a peer language
// anywhere, every sentence or list item that names Python must also say
// "AI-assisted". The summary and the headline metric are checked the same
// way.
const PEERS = /(?<!\w)(C#|C\+\+|SQL|KQL|TypeScript)(?!\w)/i;
const PYTHON = /\bPython(?:\d|\b)/i;
const AI_ASSISTED = /\bAI-assisted\b/i;

// Each block's own text (list items, rows, cells, headings, paragraphs and
// divs, nested lists split from their parent item), then each sentence.
function units(html: string): string[] {
  return decode(html.replace(/<\/?(li|ul|ol|dl|dt|dd|p|div|h[1-6]|td|th|tr|table|section|blockquote|br)\b[^>]*>/g, "\n").replace(/<[^>]*>/g, " "))
    .split("\n")
    .flatMap((block) => block.split(/(?<=[.!?])\s+/))
    .map((unit) => unit.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function pythonPeerProblems(slug: string, html: string): string[] {
  const all = units(html);
  const peer = all.join(" ").match(PEERS)?.[1];
  if (peer === undefined) return [];
  return all
    .filter((unit) => PYTHON.test(unit) && !AI_ASSISTED.test(unit))
    .map(
      (unit) =>
        `projects: "${slug}" names Python beside ${peer} in Technologies: "${unit.slice(0, 60)}"; Python is never peer depth with C#, C++, SQL, KQL or TypeScript unless it says AI-assisted`,
    );
}

describe("the Python rule", () => {
  test.each([
    ["one list", "<ul><li>C#</li><li>TypeScript</li><li>Python</li></ul>"],
    ["a nested list", "<ul><li>Languages<ul><li>C#</li><li>Python</li></ul></li></ul>"],
    ["a row with several values", "<dl><div><dt>Languages</dt><dd>C#</dd><dd>Python</dd></div></dl>"],
    ["Python3 in its own row", "<dl><div><dt>Languages</dt><dd>SQL</dd></div><div><dt>Scripting</dt><dd>Python3</dd></div></dl>"],
    ["a paragraph apart from the list", "<ul><li>C#</li><li>TypeScript</li></ul><p>Some Python for glue scripts.</p>"],
    ["a div, a heading or a cell", "<h3>Python</h3><div>KQL</div><table><tr><td>C++</td></tr></table>"],
    ["one paragraph", "<p>Built in TypeScript and Python.</p>"],
  ])("Python beside a peer in %s fails, naming the slug", (_label, html) => {
    const problems = pythonPeerProblems("x", html);
    expect(problems.length).toBeGreaterThan(0);
    for (const problem of problems) expect(problem).toMatch(/^projects: "x" names Python beside /);
  });

  test.each([
    ["a section without Python", "<ul><li>C#</li><li>TypeScript</li><li>SQL</li></ul>"],
    ["Python with no peer in the section", "<p>Python and MySQLish notes</p>"],
    ["Python marked AI-assisted in its list item", "<ul><li>C#</li><li>TypeScript</li><li>Python, AI-assisted only</li></ul>"],
    ["Python marked AI-assisted in its sentence", "<ul><li>C#</li></ul><p>Python3 scripts were AI-assisted. C# is the core.</p>"],
  ])("%s passes", (_label, html) => {
    expect(pythonPeerProblems("x", html)).toEqual([]);
  });

  test("an AI-assisted note on one sentence does not cover another", () => {
    expect(pythonPeerProblems("x", "<p>C# throughout. Python was AI-assisted. Python also ran the jobs.</p>")).toHaveLength(1);
  });

  test("no project's summary or headline metric lists Python beside a peer", () => {
    const problems = projectItems.flatMap((item) =>
      pythonPeerProblems(item.slug, [item.summary, item.headlineMetric.value, "qualifier" in item.headlineMetric ? item.headlineMetric.qualifier : ""].map((t) => `<p>${t}</p>`).join("")),
    );
    expect(problems).toEqual([]);
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
// Number words, one to twenty, the tens and hundred, read as digits, so a
// number stated in words is held to the key-value list like any other.
const NUMBER_WORDS: Record<string, number> = Object.fromEntries([
  ...["one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen", "twenty"].map((w, i) => [w, i + 1] as const),
  ...["thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"].map((w, i) => [w, (i + 3) * 10] as const),
  ["hundred", 100] as const,
]);
const digitsFor = (s: string): string =>
  s.replace(new RegExp(`\\b(${Object.keys(NUMBER_WORDS).join("|")})\\b`, "gi"), (w) => String(NUMBER_WORDS[w.toLowerCase()]));

const EM_DASH = new RegExp(String.fromCharCode(0x2014));

function bannedLines(path: string, body: string): string[] {
  const hits: string[] = [];
  body.split("\n").forEach((line, i) => {
    for (const term of confidentialTerms()) if (term.pattern.test(line)) hits.push(`${path}:${i + 1}: matches ${TERMS_FILE} line ${term.line}`);
    if (EM_DASH.test(line)) hits.push(`${path}:${i + 1}: em dash`);
  });
  return hits;
}

describe("the project copy", () => {
  test("the metadata and route copy carry no confidential term and no em dash", () => {
    const paths = ["content/projects/index.ts", "content/projects-page.ts", "content/project-page.ts"];
    expect(paths.flatMap((path) => bannedLines(path, source(path)))).toEqual([]);
  });
});

// Every project written for real (Story 3.7) is compiled and rendered inside
// the real page and checked: the eight sections, at least one labelled
// trade-off pair in Decisions, an Outcome ending in a source note then a
// key-value list that repeats every number the page states, Lessons with
// something to say, "Ralph loop" glossed wherever it appears, the repository
// call to action on PR-1 and PR-2 only, PR-2's build account as the README
// opening words it, and PR-3's plain statement of which work was agentic and
// which was direct.
describe("the written projects, rendered", async () => {
  const actual = await vi.importActual<typeof import("@/lib/evidence")>("@/lib/evidence");
  const slugs = actual.writtenItems("project").map((item) => item.slug);
  const mdxPath = (slug: string) => `content/projects/${slug}.mdx`;
  const compile = async (slug: string): Promise<MDXContent> => (await evaluate(source(mdxPath(slug)), { ...runtime, useMDXComponents })).default;
  const bodies = Object.fromEntries(await Promise.all(slugs.map(async (slug) => [slug, await compile(slug)] as const)));
  const renderWritten = async (slug: string): Promise<string> => {
    state.written = [...slugs];
    state.bodies = bodies;
    return renderPage(slug);
  };
  const sectionOf = (main: string, id: string): string => {
    const at = main.indexOf(`<section id="${id}"`);
    return at === -1 ? "" : main.slice(at, main.indexOf("</section>", at));
  };

  test("each renders the h1 then the eight sections, through the real components", async () => {
    for (const slug of slugs) {
      const main = mainOf(await renderWritten(slug));
      const headings = [...main.matchAll(/<(h[12])[^>]*>([\s\S]*?)<\/\1>/g)].map((m) => `${m[1]} ${text(m[2])}`);
      expect(headings, slug).toEqual([`h1 ${byslug(slug).title}`, ...PROJECT_SECTIONS.map((s) => `h2 ${s.label}`)]);
      expect(main, slug).not.toContain("Fixture");
    }
  });

  test("no Technologies section lists Python beside C#, C++, SQL, KQL or TypeScript", async () => {
    const problems: string[] = [];
    for (const slug of slugs) problems.push(...pythonPeerProblems(slug, sectionOf(mainOf(await renderWritten(slug)), "technologies")));
    expect(problems).toEqual([]);
  });

  test("no confidential term or em dash reaches a page or its source", async () => {
    const hits: string[] = [];
    for (const slug of slugs) {
      hits.push(...bannedLines(`${slug} (rendered)`, text(mainOf(await renderWritten(slug)))));
      hits.push(...bannedLines(mdxPath(slug), source(mdxPath(slug))));
    }
    expect(hits).toEqual([]);
  });

  const bodyOf = (main: string): string => main.slice(main.indexOf("<section"), main.lastIndexOf("</section>") + "</section>".length);
  const sentencesOf = async (slug: string): Promise<string[]> => units(bodyOf(mainOf(await renderWritten(slug))));

  test("all three projects are written, in collection order", () => {
    expect(slugs).toEqual(projectItems.map((item) => item.slug));
  });

  describe.each(slugs)("%s", (slug) => {
    test("Decisions sets out at least one decision as a labelled trade-off pair", async () => {
      const decisions = sectionOf(mainOf(await renderWritten(slug)), "decisions");
      const pairs = [...decisions.matchAll(/<li[^>]*><h3[^>]*>/g)].length;
      expect(pairs).toBeGreaterThan(0);
      expect(decisions.split(`>${caseStudyPage.tradeoff.buys}<`).length - 1).toBe(pairs);
      expect(decisions.split(`>${caseStudyPage.tradeoff.costs}<`).length - 1).toBe(pairs);
    });

    test("Outcome closes with a source note, then a key-value list", async () => {
      const outcome = sectionOf(mainOf(await renderWritten(slug)), "outcome");
      const note = outcome.indexOf(`class="${noteStyles.note}"`);
      const kv = outcome.indexOf(`class="${kvStyles.list}"`);
      expect(note, "a source note").toBeGreaterThan(-1);
      expect(kv, "a key-value list after the source note").toBeGreaterThan(note);
    });

    test("the key-value list repeats every number the page states, in digits or in words", async () => {
      const body = bodyOf(mainOf(await renderWritten(slug)));
      const kvAt = body.indexOf(`class="${kvStyles.list}"`);
      const kv = body.slice(kvAt, body.indexOf("</dl>", kvAt));
      const numbers = (html: string) => new Set(digitsFor(text(html)).match(/\d+(?:\.\d+)?/g) ?? []);
      const listed = numbers(kv);
      expect([...numbers(body)].filter((n) => !listed.has(n))).toEqual([]);
    });

    test("every one of the eight sections has at least 40 characters of text", async () => {
      const main = mainOf(await renderWritten(slug));
      for (const { id } of PROJECT_SECTIONS) {
        expect(text(sectionOf(main, id).replace(/<h2[\s\S]*?<\/h2>/, "")).length, id).toBeGreaterThanOrEqual(40);
      }
    });

    test("\"Ralph loop\" never appears without a plain-language gloss straight after it", async () => {
      const body = text(bodyOf(mainOf(await renderWritten(slug))));
      for (const match of body.matchAll(/Ralph loops?/gi)) {
        expect(body.slice((match.index ?? 0) + match[0].length)).toMatch(/^ \([^)]{12,}\)/);
      }
    });

    test("the repository call to action renders when the project has a repository, and never otherwise", async () => {
      const main = mainOf(await renderWritten(slug));
      const repository = byslug(slug).repository;
      const classes = anchors(main)
        .filter(({ attrs }) => /github\.com/.test(attr(attrs, "href") ?? ""))
        .map(({ attrs }) => [attr(attrs, "class"), attr(attrs, "href")]);
      if (repository === undefined) expect(classes).toEqual([]);
      else expect(classes).toEqual([[repoStyles.panel, repository], [repoStyles.rail, repository]]);
    });
  });

  test("PR-1 and PR-2 have a repository and PR-3 has none", () => {
    expect([pr1.repository, pr2.repository, pr3.repository]).toEqual([
      "https://github.com/shahrouzmohaghegh/career-application-system",
      "https://github.com/shahrouzmohaghegh/shahrouz-portfolio",
      undefined,
    ]);
  });

  // PR-2's account of how the site was built is the README's own opening, word for word.
  test("PR-2 carries the build account the README opens with", async () => {
    const account = "built with BMAD agents while Shahrouz held the requirements, architecture, decisions and review";
    const opening = source("README.md").split("\n\n")[1];
    expect(opening, "the README opening still says it").toContain(account);
    expect(text(mainOf(await renderWritten(pr2.slug)))).toContain(account);
  });

  // PR-3 says plainly which work was driven through agentic loops and which was direct.
  // Only while PR-3 is written: the spec's fallback drops it from the list.
  test.runIf(slugs.includes(pr3.slug))("PR-3 states the agentic work, that he has not written Angular by hand, and the direct AKS, Azure and SQL work", async () => {
    const sentences = await sentencesOf(pr3.slug);
    const some = (label: string, ...patterns: RegExp[]) =>
      expect(sentences.some((s) => patterns.every((p) => p.test(s))), label).toBe(true);
    some("the Angular coverage and upgrade work was driven through agentic loops", /Angular/, /coverage/, /upgrade/, /driven through agentic loops/);
    some("the .NET upgrade was driven through agentic loops", /\.NET 8 to \.NET 10/, /driven through agentic loops/);
    some("he has not written Angular by hand", /\bnot written Angular by hand\b/);
    some("the AKS, Azure and SQL work was direct hands-on engineering", /\bAKS\b/, /\bAzure\b/, /\bSQL\b/, /\bdirect hands-on engineering\b/);
  });
});
