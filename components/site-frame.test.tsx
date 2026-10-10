// The route frame (UX-DR28, FR-7, FR-24). Every app/**/page.* and every
// app/**/not-found.* renders one header, one nav labelled
// "Primary", one main and one footer, with the wordmark and the three nav
// items in order, and marks only its own nav item as current (a not-found
// page marks none). The footer's links and copy are checked too. A new route
// that forgets <SiteFrame> fails here by name, because the glob finds it.
//
// Rendered with react-dom/server under the node environment, so the checks
// read the static markup. A header or footer inside <main> (an article's own
// header, say) is not a landmark and is not counted.

import { readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import type { ComponentType, ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";

import { site } from "@/content/site";
import { SiteFooter } from "./site-footer";

const APP_DIR = fileURLToPath(new URL("../app/", import.meta.url));
const NAV_HREFS = ["/", "/experience", "/projects", "/contact"];

type RouteModule = { default: ComponentType<Record<string, unknown>> };
type Frame = { header: number; main: number; footer: number; nav: number; links: Array<{ href: string; current: boolean }> };

const PAGE_FILE = /^page\.(tsx|ts|jsx|js)$/;
const NOT_FOUND_FILE = /^not-found\.(tsx|ts|jsx|js)$/;

function routeFiles(name: RegExp, dir: string = APP_DIR): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...routeFiles(name, path));
    else if (name.test(entry.name)) found.push(path);
  }
  return found.sort();
}

// app/page.tsx is "/", app/projects/page.tsx is "/projects" (likewise for not-found). Route groups
// "(name)" add no segment.
function routeOf(file: string): string {
  const segments = relative(APP_DIR, file).split(sep).slice(0, -1).filter((s) => !/^\(.*\)$/.test(s));
  return `/${segments.join("/")}`;
}

// Calls the component itself first, so an async server component resolves.
async function render(file: string): Promise<string> {
  const { default: Page } = (await import(file)) as RouteModule;
  const props = { params: Promise.resolve({}), searchParams: Promise.resolve({}) };
  const element = (await (Page as (p: typeof props) => ReactNode | Promise<ReactNode>)(props)) as ReactNode;
  return renderToStaticMarkup(<>{element}</>);
}

const count = (html: string, tag: string): number => html.match(new RegExp(`<${tag}[\\s>]`, "g"))?.length ?? 0;

function readFrame(html: string): Frame {
  const mains = count(html, "main");
  const mainStart = html.search(/<main[\s>]/);
  const mainEnd = html.lastIndexOf("</main>");
  // Landmarks only: drop everything inside <main> before counting header and footer.
  const outside = mainStart === -1 || mainEnd === -1 ? html : html.slice(0, mainStart) + html.slice(mainEnd);
  const navs = [...html.matchAll(/<nav\s[^>]*aria-label="Primary"[^>]*>([\s\S]*?)<\/nav>/g)];
  const header = outside.match(/<header[\s>][\s\S]*?<\/header>/)?.[0] ?? "";
  const navInHeader = navs.filter((n) => header.includes(n[0])).length;
  const links = [...(navs[0]?.[1] ?? "").matchAll(/<a\s([^>]*)>/g)].map(([, attrs]) => ({
    href: attrs.match(/href="([^"]*)"/)?.[1] ?? "",
    current: /aria-current="page"/.test(attrs),
  }));
  return {
    header: count(outside, "header"),
    main: mains,
    footer: count(outside, "footer"),
    // 1 only when the one Primary nav sits inside the landmark header.
    nav: navs.length === 1 ? (navInHeader === 1 ? 1 : 0) : navs.length,
    links,
  };
}

function expectFrame(route: string, frame: Frame): void {
  expect(frame.header, `${route}: one <header> landmark`).toBe(1);
  expect(frame.nav, `${route}: one <nav aria-label="Primary"> inside the header`).toBe(1);
  expect(frame.main, `${route}: one <main>`).toBe(1);
  expect(frame.footer, `${route}: one <footer> landmark`).toBe(1);
  expect(frame.links.map((l) => l.href), `${route}: nav links in order`).toEqual(NAV_HREFS);
}

const pages = routeFiles(PAGE_FILE).map((file) => ({ file, route: routeOf(file) }));
const notFounds = routeFiles(NOT_FOUND_FILE).map((file) => ({ file, route: `not-found ${routeOf(file)}` }));

describe("every route renders the site frame", () => {
  test("the glob finds the four routes", () => {
    expect(pages.map((p) => p.route)).toEqual(expect.arrayContaining(NAV_HREFS));
  });

  test.each(pages)("$route", async ({ file, route }) => {
    const frame = readFrame(await render(file));
    expectFrame(route, frame);
    const current = frame.links.filter((l) => l.current).map((l) => l.href);
    if (NAV_HREFS.includes(route)) {
      expect(current, `${route}: only its own nav item is current`).toEqual([route]);
    } else {
      expect(current.length, `${route}: at most one nav item is current`).toBeLessThanOrEqual(1);
    }
  });

  test("the glob finds the catch-all not-found", () => {
    expect(notFounds.map((n) => n.route)).toContain("not-found /");
  });

  test.each(notFounds)("$route", async ({ file, route }) => {
    const frame = readFrame(await render(file));
    expectFrame(route, frame);
    expect(frame.links.filter((l) => l.current), `${route}: no nav item is current`).toEqual([]);
  });

  test("the catch-all not-found has a Page not found heading", async () => {
    expect(await render(join(APP_DIR, "not-found.tsx"))).toMatch(/<h1[^>]*>Page not found<\/h1>/);
  });
});

describe("the frame checks themselves", () => {
  test("a page without the frame fails", () => {
    const frame = readFrame("<main><h1>Bare</h1></main>");
    expect(() => expectFrame("/bare", frame)).toThrow(/\/bare: one <header> landmark/);
  });

  test("a Primary nav outside the header fails", () => {
    const frame = readFrame('<header></header><nav aria-label="Primary"><a href="/">x</a></nav><main></main><footer></footer>');
    expect(() => expectFrame("/stray-nav", frame)).toThrow(/\/stray-nav: one <nav aria-label="Primary"> inside the header/);
  });

  test("a header inside main is not a landmark", () => {
    const frame = readFrame(
      '<header><nav aria-label="Primary"><a href="/">x</a></nav></header><main><article><header>h</header></article></main><footer></footer>',
    );
    expect(frame.header).toBe(1);
  });
});

describe("the footer", () => {
  const html = renderToStaticMarkup(<SiteFooter />);
  const hrefs = [...html.matchAll(/href="([^"]*)"/g)].map((m) => m[1]);

  test("links to email, LinkedIn and both evidence routes", () => {
    expect(hrefs).toEqual(
      expect.arrayContaining(["mailto:shahrouz.mohaghegh@gmail.com", site.linkedin.href, "/experience", "/projects"]),
    );
    expect(site.linkedin.href).toBe("https://www.linkedin.com/in/shahrouz-mohaghegh/");
  });

  test("carries the CV note", () => {
    expect(html).toContain("No CV download. Ask by email and I will send the version written for the role.");
  });

  test("never renders the address as one contiguous text run outside the href", () => {
    expect(site.email).toBe("shahrouz.mohaghegh@gmail.com");
    expect(html.replace(/href="[^"]*"/g, "")).not.toContain(site.email);
  });
});
