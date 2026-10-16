// The capability filter's Server Components (Epic 4). Rendered to static
// markup, which is what every visitor gets: the chips are plain links, in a
// list inside a group named by its visible label; a selected chip carries
// aria-current="true", a hidden check glyph and the hidden ", selected"; and
// nothing carries aria-pressed, role="status", aria-live or a tabindex. Every
// filter href ends in #filter-status. The stylesheet is read for the
// DESIGN.md capability-chip rules: the chip-border hairline, the accent fill
// when selected, and wrapping rather than scrolling.
//
// next/link is mocked to mark what it renders, so the anchor checks can
// tell a plain <a> from a next/link one: every link to a listing, in the
// filter, the header and the footer, must be plain.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";

import { capabilityFilter } from "@/content/capability-filter";
import { CAPABILITIES, caseStudyItems, crossListing, filterLinkHref, type Capability } from "@/lib/evidence";
import { CapabilityChips, CrossListingLink, EmptyState, FilterStateLine } from "./capability-filter";
import styles from "./capability-filter.module.css";
import { SiteFooter } from "./site-footer";
import { SiteHeader } from "./site-header";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} data-next-link="" {...rest}>
      {children}
    </a>
  ),
}));

const chips = (selection: Capability[]) => renderToStaticMarkup(<CapabilityChips kind="case-study" selection={selection} />);
const total = caseStudyItems.length;
const caseStudies = (count: number) => `${count} ${count === 1 ? "case study" : "case studies"}`;

describe("the chips", () => {
  test("an unselected chip is a link with its label and nothing else", () => {
    expect(chips([])).toContain(
      `<li><a href="/experience?capability=leadership#filter-status" class="${styles.chip}">Leadership</a></li>`,
    );
  });

  test("a selected chip: aria-current, the hidden glyph and text, its href the selection minus itself", () => {
    expect(chips(["leadership", "hands-on"])).toContain(
      `<li><a href="/experience?capability=hands-on#filter-status" class="${styles.chip}" aria-current="true">` +
        `<span aria-hidden="true">✓</span>Leadership` +
        `<span class="${styles.visuallyHidden}">${capabilityFilter.selectedHint}</span></a></li>`,
    );
  });

  test("a group named by its visible label wraps a plain list of four links; no button, no aria-pressed", () => {
    const html = chips(["ai-native"]);
    expect(
      html.startsWith(
        `<div role="group" aria-labelledby="capfilter"><p id="capfilter" class="${styles.label}">` +
          `${capabilityFilter.groupLabel}</p><ul class="${styles.chips}"><li>`,
      ),
    ).toBe(true);
    expect(html).not.toMatch(/<ul[^>]*role=/);
    expect([...html.matchAll(/<a /g)]).toHaveLength(CAPABILITIES.length);
    expect(html).not.toMatch(/<button|aria-pressed|role="status"|aria-live|tabindex|data-next-link/);
  });
});

describe("the state line, cross-listing link and empty state", () => {
  test("the state line is a plain paragraph, not focusable and not a live region", () => {
    const html = renderToStaticMarkup(<FilterStateLine kind="case-study" selection={[]} items={caseStudyItems} />);
    expect(html).toBe(
      `<p id="filter-status" class="${styles.stateLine}"><span class="${styles.emphasis}">` +
        `Showing all ${caseStudies(total)}.</span> No capability filter applied.</p>`,
    );
  });

  test("the cross-listing link is one plain link, the count prefix first, ending in the fragment", () => {
    const link = crossListing("case-study", ["hands-on"]);
    if (link === undefined) throw new Error("no projects carry hands-on");
    const html = renderToStaticMarkup(<CrossListingLink link={link} />);
    expect(html).toBe(
      `<p class="${styles.crossListing}"><a href="/projects?capability=hands-on#filter-status" ` +
        `class="${styles.crossListingLink}"><span class="${styles.count}">${link.prefix}</span>${link.rest}</a></p>`,
    );
  });

  test("the empty state without a cross-listing match still explains and links back", () => {
    const html = renderToStaticMarkup(<EmptyState kind="project" link={undefined} explanation="Nothing here." />);
    expect(html).toBe(
      `<div class="${styles.empty}"><p class="${styles.emptyText}">Nothing here.</p>` +
        `<p class="${styles.emptyText}"><a href="${filterLinkHref("project", [])}" class="${styles.emptyLink}">` +
        `${capabilityFilter.showAll}</a></p></div>`,
    );
    expect(filterLinkHref("project", [])).toBe("/projects#filter-status");
  });
});

// Every filter change, and every move to a listing, is a full page load:
// next/link keeps a stale document title on a search-param-only navigation
// in Next.js 16.4.0, and the title is the only announcement (AD-3). See the
// note in components/capability-filter.tsx.
describe("links to a listing are plain anchors", () => {
  test("capability-filter.tsx imports no next/link and nothing client-side", () => {
    const code = readFileSync(join(process.cwd(), "components/capability-filter.tsx"), "utf8");
    expect(code).not.toMatch(/from\s+["']next\/link["']|<Link\b|["']use client["']|useState|useEffect/);
  });

  const anchors = (html: string) =>
    [...html.matchAll(/<a ([^>]*)>/g)].map(([, attrs]) => ({
      href: attrs.match(/href="([^"]*)"/)?.[1] ?? "",
      nextLink: /data-next-link/.test(attrs),
    }));

  test.each([
    ["the header", () => renderToStaticMarkup(<SiteHeader current="/experience" />)],
    ["the footer", () => renderToStaticMarkup(<SiteFooter />)],
  ])("%s links /experience and /projects with plain anchors, and nothing else changes", (_name, render) => {
    const links = anchors(render());
    for (const href of ["/experience", "/projects"]) {
      const link = links.find((each) => each.href === href);
      expect(link, `${href} is linked`).toBeDefined();
      expect(link?.nextLink, `${href} is a plain anchor`).toBe(false);
    }
    for (const link of links.filter((each) => ["/", "/contact"].includes(each.href))) {
      expect(link.nextLink, `${link.href} stays next/link`).toBe(true);
    }
  });
});

describe("the stylesheet", () => {
  const css = readFileSync(join(process.cwd(), "components/capability-filter.module.css"), "utf8");
  const rule = (selector: string): string =>
    css.match(new RegExp(`(?:^|\\n)${selector.replace(/[.[\]"=]/g, "\\$&")}\\s*\\{([^}]*)\\}`))?.[1] ?? "";

  test("chips wrap, never scroll, and carry the chip-border hairline at full radius", () => {
    expect(rule(".chips")).toMatch(/flex-wrap:\s*wrap/);
    expect(css).not.toMatch(/overflow-x|overflow:\s*(auto|scroll)/);
    expect(rule(".chip")).toMatch(/border:\s*var\(--space-rule-hairline\) solid var\(--color-chip-border\)/);
    expect(rule(".chip")).toMatch(/border-radius:\s*var\(--radius-full\)/);
    expect(rule(".chip")).toMatch(/padding:\s*var\(--component-capability-chip-padding\)/);
  });

  test("a selected chip takes the accent fill with on-accent text, and no rule touches the focus ring", () => {
    expect(rule('.chip[aria-current="true"]')).toMatch(/background:\s*var\(--color-accent\)/);
    expect(rule('.chip[aria-current="true"]')).toMatch(/color:\s*var\(--color-on-accent\)/);
    expect(css).not.toMatch(/outline|--focus-ring/);
  });
});
