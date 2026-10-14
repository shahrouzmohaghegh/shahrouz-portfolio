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
// per project in collection order with "Read the project", and no noindex.
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

import gridStyles from "@/components/card-grid.module.css";
import cardStyles from "@/components/evidence-card.module.css";
import { metricSentence } from "@/components/evidence-card";
import repoStyles from "@/components/repo-cta.module.css";
import { repoCtaName } from "@/components/repo-cta";
import { projectPage } from "@/content/project-page";
import { projectsPage } from "@/content/projects-page";
import { useMDXComponents } from "@/mdx-components";
import {
  CAPABILITY_NAME,
  PROJECT_SECTION_GROUPS,
  PROJECT_SECTIONS,
  caseStudyItems,
  listingTitle,
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

describe("the /projects listing", () => {
  const html = renderToStaticMarkup(<>{listing.default() as ReactNode}</>);
  const main = mainOf(html);

  test("content/projects-page.ts holds the reviewed words", () => {
    expect(projectsPage).toEqual({
      heading: "Projects",
      description:
        "Projects in hands-on engineering: a governed multi-agent system, this website, and platform modernisation through agentic loops.",
      intro: "Systems I built, each with the decisions behind it, what they cost, and how they were tested.",
      cta: "Read the project",
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
    expect(main.split(`<ul class="${gridStyles.grid}">`)).toHaveLength(2);
    const page = source("app/projects/page.tsx");
    expect(page).toMatch(/<CardGrid\s+items=\{projectItems\}[^>]*headingLevel=\{2\}/);
    for (const item of projectItems) expect(page).not.toContain(item.slug);
  });

  test("no chips, state line or filter yet (Epic 4), and no repository link on the listing", () => {
    expect(main).not.toMatch(/role="status"|aria-current="true"|capability=/);
    expect(main).not.toMatch(/<form[\s>]|<input[\s>]|<button[\s>]/);
    expect(main).not.toMatch(/github\.com/);
  });

  test("the primary nav marks Projects as current", () => {
    expect(primaryCurrent(html)).toEqual(["/projects"]);
  });

  test("the title comes from listingTitle, the description from content, and there is no noindex", () => {
    expect(listing.metadata.title).toBe(listingTitle("project"));
    expect(listing.metadata.description).toBe(projectsPage.description);
    expect(listing.metadata.robots).toBeUndefined();
  });

  test("the route stays static and reaches no island", () => {
    const page = source("app/projects/page.tsx");
    expect(page).not.toMatch(/searchParams|export const dynamic|cookies\(|headers\(/);
    expect(specifiers(page).filter((s) => /(^|\/)islands\//.test(s))).toEqual([]);
  });
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
    expect(decode(attr(attrs, "aria-label") ?? "")).toBe(repoCtaName(projectPage.repository.title, pr1.repository ?? ""));
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
    // The accessible name holds the visible title, so speech input can use it.
    expect(text(repeats[0].inner)).toContain(projectPage.repository.title);
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

  // The committed list is empty until Story 3.7 writes the prose; that
  // story updates this test in the same change that adds a slug.
  test("with the committed written list empty, no project page is generated", async () => {
    const actual = await vi.importActual<typeof import("@/lib/evidence")>("@/lib/evidence");
    expect(actual.writtenItems("project")).toEqual([]);
    state.written = [];
    expect(route.generateStaticParams()).toEqual([]);
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

// Any project written for real (Story 3.7) is compiled and rendered inside
// the real page. None is written yet, so these loops run over nothing; they
// start checking as each slug joins writtenProjectSlugs.
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
});
