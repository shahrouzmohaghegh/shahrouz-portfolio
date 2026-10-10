// Figure demotion, step one (DESIGN.md Typography, Figure demotion): the
// rendered character count of a figure phrase selects its type role. Pinned
// at both boundaries, 14/15 and 32/33, and on Home's two band figures.

import { describe, expect, test } from "vitest";

import { figureRole } from "@/lib/figure-role";

const phrase = (length: number): string => "9".repeat(length);

describe("figureRole", () => {
  test.each([
    [1, "figure"],
    [14, "figure"],
    [15, "figure-small"],
    [32, "figure-small"],
    [33, "pull-quote"],
    [80, "pull-quote"],
  ])("a %i-character figure is %s", (length, role) => {
    expect(figureRole(phrase(length))).toBe(role);
  });

  test("Home's band figures size as DESIGN.md's worked examples say", () => {
    expect(figureRole("20% to 76%")).toBe("figure");
    expect(figureRole("Over 1 per fix to under 1 in 5")).toBe("figure-small");
    expect(figureRole("above 100% to below 20%")).toBe("figure-small");
  });

  test("characters are counted as rendered, not as UTF-16 units", () => {
    // 14 code points, 15 UTF-16 units: the astral character counts once.
    expect(figureRole(`${phrase(13)}\u{1D7D7}`)).toBe("figure");
  });

  test("a URL is a pull-quote figure whatever its length", () => {
    expect(figureRole("https://x.io")).toBe("pull-quote");
  });
});
