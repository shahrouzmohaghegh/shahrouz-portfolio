// Tests for check-a11y.mts's pure rules. Run with: npm run test:scripts
//
// The browser run itself is the gate step (it needs a served build and
// Chromium); these pin the judgements it makes on what the browser reads.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  FAILING_IMPACTS,
  MIN_RING_CONTRAST,
  WIDTHS,
  composite,
  contrastRatio,
  effectiveGround,
  failingViolations,
  focusProblems,
  headingProblems,
  isDetailRoute,
  landmarkProblems,
  lineCount,
  overflows,
  parseColour,
  type FocusStop,
  type Landmarks,
} from "./check-a11y.mts";

const ONE: Landmarks = { header: 1, primaryNav: 1, main: 1, footer: 1, nav: 1, navInMain: 0 };

describe("colour", () => {
  test("parseColour reads both rgb syntaxes", () => {
    assert.deepEqual(parseColour("rgb(126, 46, 22)"), { r: 126, g: 46, b: 22, a: 1 });
    assert.deepEqual(parseColour("rgba(0, 0, 0, 0)"), { r: 0, g: 0, b: 0, a: 0 });
    assert.deepEqual(parseColour("rgb(1 2 3 / 50%)"), { r: 1, g: 2, b: 3, a: 0.5 });
    assert.equal(parseColour("transparent"), null);
  });

  test("contrastRatio is WCAG's, symmetric", () => {
    const black = { r: 0, g: 0, b: 0, a: 1 };
    const white = { r: 255, g: 255, b: 255, a: 1 };
    assert.equal(Math.round(contrastRatio(black, white) * 100) / 100, 21);
    assert.equal(contrastRatio(white, black), contrastRatio(black, white));
    assert.equal(contrastRatio(white, white), 1);
  });
});

describe("landmarks", () => {
  test("one of each passes on a listing; a detail page needs the rail inside main", () => {
    assert.deepEqual(landmarkProblems("/experience", ONE), []);
    assert.deepEqual(landmarkProblems("/experience/a", { ...ONE, nav: 2, navInMain: 1 }), []);
    assert.equal(landmarkProblems("/experience/a", ONE).length, 1);
    assert.equal(landmarkProblems("/projects/b", { ...ONE, nav: 3, navInMain: 2 }).length, 1);
    // A not-found answer under a detail prefix has no rail, and is not held to it.
    assert.deepEqual(landmarkProblems("/experience/unwritten", ONE, 404), []);
  });

  test("a missing or doubled landmark fails, naming it", () => {
    assert.deepEqual(landmarkProblems("/", { ...ONE, main: 0, footer: 2 }), ["has 0 main, expected exactly one", "has 2 footer, expected exactly one"]);
    assert.deepEqual(landmarkProblems("/", { ...ONE, primaryNav: 0 }), ['has 0 nav[aria-label="Primary"], expected exactly one']);
  });

  test("detail routes are the two families' slugs, not the listings or filtered states", () => {
    assert.equal(isDetailRoute("/experience/x"), true);
    assert.equal(isDetailRoute("/projects/x"), true);
    assert.equal(isDetailRoute("/projects"), false);
    assert.equal(isDetailRoute("/experience?capability=leadership"), false);
  });
});

describe("headings", () => {
  test("starting at h1 and stepping down one level at a time passes; going back up any amount passes", () => {
    assert.deepEqual(headingProblems([1, 2, 3, 2, 3, 3, 2]), []);
    assert.deepEqual(headingProblems([1, 2, 3, 2, 2]), []);
  });

  test("a skipped level, a first heading other than h1, or no heading fails", () => {
    assert.deepEqual(headingProblems([1, 3]), ["heading 2 skips from h1 to h3"]);
    assert.deepEqual(headingProblems([2, 3]), ["the first heading is an h2, not an h1"]);
    assert.deepEqual(headingProblems([]), ["has no heading"]);
  });
});

describe("the focus ring", () => {
  const stop = (outlineColour: string, ground: string, extra: Partial<FocusStop> = {}): FocusStop => ({
    label: "<a>",
    outlineStyle: "solid",
    outlineWidth: 2,
    outlineColour,
    grounds: [ground],
    ...extra,
  });

  test("the light-ground ring on paper passes 3:1; the same ring on the deep ground fails", () => {
    assert.deepEqual(focusProblems([stop("rgb(126, 46, 22)", "rgb(251, 247, 241)")]), []);
    const [problem] = focusProblems([stop("rgb(126, 46, 22)", "rgb(36, 29, 24)")]);
    assert.match(problem, /focus ring contrast 1\.\d\d:1 against its ground, below 3:1/);
    assert.equal(MIN_RING_CONTRAST, 3);
  });

  test("the on-deep ring on the deep ground passes", () => {
    assert.deepEqual(focusProblems([stop("rgb(227, 165, 126)", "rgb(36, 29, 24)")]), []);
  });

  test("an opaque rgb() ground is read as opaque: its blue channel is never taken for alpha", () => {
    // rgb(36, 29, 24): a ring that passes on paper fails here, so the deep ground was read.
    assert.equal(focusProblems([stop("rgb(126, 46, 22)", "rgb(36, 29, 24)")]).length, 1);
    assert.deepEqual(effectiveGround(["rgb(36, 29, 0)"]), { r: 36, g: 29, b: 0, a: 1 });
  });

  test("transparent and translucent grounds are composited down to the nearest opaque one", () => {
    assert.deepEqual(effectiveGround(["rgba(0, 0, 0, 0)", "transparent", "rgb(10, 20, 30)", "rgb(255, 0, 0)"]), { r: 10, g: 20, b: 30, a: 1 });
    const half = effectiveGround(["rgba(0, 0, 0, 0.5)", "rgb(255, 255, 255)"]);
    assert.ok(half !== null && Math.round(half.r) === 128 && half.a === 1);
    assert.deepEqual(effectiveGround([]), { r: 255, g: 255, b: 255, a: 1 });
    assert.equal(effectiveGround(["not a colour"]), null);
  });

  test("a translucent ring is judged as it composites over its ground", () => {
    // The light ring at 20% opacity over paper is far below 3:1.
    assert.equal(focusProblems([stop("rgba(126, 46, 22, 0.2)", "rgb(251, 247, 241)")]).length, 1);
    assert.deepEqual(composite({ r: 0, g: 0, b: 0, a: 1 }, { r: 255, g: 255, b: 255, a: 1 }), { r: 0, g: 0, b: 0, a: 1 });
  });

  test("no outline fails", () => {
    assert.deepEqual(focusProblems([stop("rgb(0, 0, 0)", "rgb(255, 255, 255)", { outlineStyle: "none" })]), ["<a> shows no focus outline"]);
    assert.deepEqual(focusProblems([stop("rgb(0, 0, 0)", "rgb(255, 255, 255)", { outlineWidth: 0 })]), ["<a> shows no focus outline"]);
  });
});

describe("widths", () => {
  test("the four widths, and overflow is any content wider than the viewport", () => {
    assert.deepEqual(WIDTHS, [320, 375, 768, 1440]);
    assert.equal(overflows(376, 375), true);
    assert.equal(overflows(375, 375), false);
  });

  test("lineCount groups boxes by their top, within 2px", () => {
    assert.equal(lineCount([10, 10.5, 11]), 1);
    assert.equal(lineCount([10, 40, 41]), 2);
    assert.equal(lineCount([10, 40, 70]), 3);
  });
});

describe("axe", () => {
  test("only serious and critical violations fail", () => {
    assert.deepEqual(FAILING_IMPACTS, ["serious", "critical"]);
    const kept = failingViolations([
      { id: "a", impact: "minor", nodes: 1 },
      { id: "b", impact: "moderate", nodes: 1 },
      { id: "c", impact: "serious", nodes: 2 },
      { id: "d", impact: "critical", nodes: 1 },
      { id: "e", impact: null, nodes: 1 },
    ]);
    assert.deepEqual(kept.map((v) => v.id), ["c", "d"]);
  });
});
