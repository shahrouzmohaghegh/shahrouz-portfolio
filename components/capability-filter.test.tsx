// The capability filter's Server Components (Epic 4). Rendered to static
// markup, which is what every visitor gets: the chips are plain links in a group named by its visible label, a selected chip carries
// aria-current="true", a hidden check glyph and the hidden ", selected", and
// nothing carries aria-pressed, role="status", aria-live or a tabindex. The
// stylesheet is read for the DESIGN.md capability-chip rules: the chip-border
// hairline, the accent fill when selected, and wrapping rather than
// scrolling.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";

import { capabilityFilter } from "@/content/capability-filter";
import { CAPABILITIES, caseStudyItems, crossListing, type Capability } from "@/lib/evidence";
import { CapabilityChips, CrossListingLink, EmptyState, FilterStateLine } from "./capability-filter";
import styles from "./capability-filter.module.css";

const chips = (selection: Capability[]) => renderToStaticMarkup(<CapabilityChips kind="case-study" selection={selection} />);

describe("the chips", () => {
  test("an unselected chip is a link with its label and nothing else", () => {
    expect(chips([])).toContain(`<li><a href="/experience?capability=leadership" class="${styles.chip}">Leadership</a></li>`);
  });

  test("a selected chip: aria-current, the hidden check glyph and the hidden selected text, its href the selection minus itself", () => {
    expect(chips(["leadership", "hands-on"])).toContain(
      `<li><a href="/experience?capability=hands-on" class="${styles.chip}" aria-current="true"><span aria-hidden="true">✓</span>Leadership<span class="${styles.visuallyHidden}">${capabilityFilter.selectedHint}</span></a></li>`,
    );
  });

  test("a group named by its visible label, four links in chip order, no button and no aria-pressed", () => {
    const html = chips(["ai-native"]);
    expect(html.startsWith(`<p id="capfilter" class="${styles.label}">Filter by capability</p><ul role="group" aria-labelledby="capfilter"`)).toBe(true);
    expect([...html.matchAll(/<a /g)]).toHaveLength(CAPABILITIES.length);
    expect(html).not.toMatch(/<button|aria-pressed|role="status"|aria-live|tabindex/);
  });
});

describe("the state line, cross-listing link and empty state", () => {
  test("the state line is a plain paragraph, not focusable and not a live region", () => {
    const html = renderToStaticMarkup(<FilterStateLine kind="case-study" selection={[]} items={caseStudyItems} />);
    expect(html).toBe(
      `<p id="filter-status" class="${styles.stateLine}"><span class="${styles.emphasis}">Showing all 3 case studies.</span> No capability filter applied.</p>`,
    );
  });

  test("the cross-listing link is one link, the count prefix first", () => {
    const link = crossListing("case-study", ["hands-on"]);
    if (link === undefined) throw new Error("no projects carry hands-on");
    const html = renderToStaticMarkup(<CrossListingLink link={link} />);
    expect(html).toBe(
      `<p class="${styles.crossListing}"><a href="/projects?capability=hands-on" class="${styles.crossListingLink}"><span class="${styles.count}">${link.prefix}</span>${link.rest}</a></p>`,
    );
  });

  test("the empty state without a cross-listing match still explains and links back", () => {
    const html = renderToStaticMarkup(<EmptyState kind="project" link={undefined} explanation="Nothing here." />);
    expect(html).toBe(
      `<div class="${styles.empty}"><p class="${styles.emptyText}">Nothing here.</p><p class="${styles.emptyText}"><a href="/projects" class="${styles.emptyLink}">${capabilityFilter.showAll}</a></p></div>`,
    );
  });
});

// Every filter change is a full page load: next/link keeps a stale document
// title on a search-param-only navigation in Next.js 16.4.0, and the title is
// the only announcement (AD-3). See the note in capability-filter.tsx.
test("the filter links are plain anchors: capability-filter.tsx imports no next/link and nothing client-side", () => {
  const code = readFileSync(join(process.cwd(), "components/capability-filter.tsx"), "utf8");
  expect(code).not.toMatch(/from\s+["']next\/link["']|<Link\b|["']use client["']|useState|useEffect/);
});

describe("the stylesheet", () => {
  const css = readFileSync(join(process.cwd(), "components/capability-filter.module.css"), "utf8");
  const rule = (selector: string): string => css.match(new RegExp(`(?:^|\\n)${selector.replace(/[.[\]"=]/g, "\\$&")}\\s*\\{([^}]*)\\}`))?.[1] ?? "";

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
