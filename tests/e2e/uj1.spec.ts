import { expect, test, type Page } from "@playwright/test";

import { home } from "../../content/home";
import { site } from "../../content/site";

// UJ-1, the recruiter's skim (Story 5.1, FR-27 as amended 2026-10-07): the
// one Playwright test the architecture allows (AD-18). Home at 375 x 550
// (UX-DR47, what iOS Safari shows on a 375 x 667 phone) must show, without
// scrolling, the positioning statement, the availability line, the
// 38-person span, the Digital Governance Board seat and both figures of the
// figure pair. Every assertion is about position and visibility, not DOM
// presence: each target's box must sit wholly inside the first viewport, and
// its effective opacity, through every ancestor, must be 1, so an unfired
// reveal target (opacity 0) or a box below the fold fails.

const VIEWPORT = { width: 375, height: 550 };

// The pilot-metric rule (FR-29): either wording of the pilot scope passes.
const PILOT_SCOPE = /^across (AI-assisted )?pilot projects$/;

type Seen = { top: number; bottom: number; left: number; right: number; opacity: number; hidden: boolean } | null;

// Where a phrase renders: the box of the exact text range inside the
// element whose own text contains it, and that element's effective opacity.
function locate(page: Page, phrase: string): Promise<Seen> {
  return page.evaluate((needle) => {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
      const at = node.textContent?.indexOf(needle) ?? -1;
      if (at === -1) continue;
      const range = document.createRange();
      range.setStart(node, at);
      range.setEnd(node, at + needle.length);
      const box = range.getBoundingClientRect();
      let opacity = 1;
      let hidden = false;
      for (let el: Element | null = node.parentElement; el !== null; el = el.parentElement) {
        const style = getComputedStyle(el);
        opacity *= Number(style.opacity);
        if (style.visibility === "hidden" || style.display === "none") hidden = true;
      }
      return { top: box.top, bottom: box.bottom, left: box.left, right: box.right, opacity, hidden };
    }
    return null;
  }, phrase);
}

test("UJ-1: at 375 x 550 Home shows the positioning, availability, scale, board seat and both figures above the fold", async ({ page }) => {
  await page.setViewportSize(VIEWPORT);
  await page.goto("/");
  await page.waitForLoadState("load");

  const people = home.figurePair.find((row) => /engineers/.test(row.words));
  const cycle = home.figurePair.find((row) => /cycle time/.test(row.words));
  expect(people, "the figure pair has the people figure").toBeDefined();
  expect(cycle, "the figure pair has the cycle-time figure").toBeDefined();
  expect(cycle?.scope, "the cycle-time figure carries the pilot scope").toMatch(PILOT_SCOPE);

  const targets: Array<[string, string]> = [
    ["the positioning statement", home.statement],
    ["the availability line", site.availability],
    ["the 38-person span", "38-person"],
    ["the Digital Governance Board seat", "Digital Governance Board"],
    ["the people figure", people?.figure ?? "(missing)"],
    ["the cycle-time figure", cycle?.figure ?? "(missing)"],
  ];
  for (const [name, phrase] of targets) {
    const seen = await locate(page, phrase);
    expect(seen, `${name} renders on Home`).not.toBeNull();
    if (seen === null) continue;
    expect(seen.hidden, `${name} is not hidden`).toBe(false);
    expect(seen.opacity, `${name} is fully opaque, not an unfired reveal`).toBe(1);
    expect(seen.top, `${name} starts inside the first viewport`).toBeGreaterThanOrEqual(0);
    expect(seen.bottom, `${name} ends above the ${VIEWPORT.height}px fold`).toBeLessThanOrEqual(VIEWPORT.height);
    expect(seen.left, `${name} starts inside the viewport`).toBeGreaterThanOrEqual(0);
    expect(seen.right, `${name} ends inside the viewport`).toBeLessThanOrEqual(VIEWPORT.width);
  }
  expect(await page.evaluate(() => window.scrollY), "nothing scrolled").toBe(0);
});
