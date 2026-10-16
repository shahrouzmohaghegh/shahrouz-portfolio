// The one-test cap (AD-18, Story 5.1). Run with: npm run test:scripts
//
// Exactly one Playwright test exists: the UJ-1 skim in tests/e2e/uj1.spec.ts.
// Every file in the working tree (tracked or not, ignored files aside) that
// imports Playwright's test runner, or is named like a Playwright spec, is
// read, and every test() call in it counted. The audit scripts drive
// Chromium through the same package (scripts/check-a11y.mts,
// scripts/check-lighthouse.mts) but declare no test, so they count zero. A
// second test needs a new architecture decision, not an edit here.

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";

export const THE_TEST = "tests/e2e/uj1.spec.ts";

// A test declaration: test(...), test(...) with any modifier, or it(...).
const DECLARATION = /(?<![\w.$])(?:test(?:\.(?:only|skip|fixme|fail|slow))?|it)\s*\(/g;
const IMPORTS_RUNNER = /from\s+["'](?:@playwright\/test|playwright\/test)["']|require\(\s*["'](?:@playwright\/test|playwright\/test)["']\s*\)/;
const SPEC_NAME = /\.spec\.(?:[cm]?[jt]sx?)$/;

// The Playwright test declarations in one file; zero for a file that is not
// a Playwright file.
export function playwrightTests(path: string, source: string): number {
  if (!IMPORTS_RUNNER.test(source) && !SPEC_NAME.test(path)) return 0;
  const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
  return [...code.matchAll(DECLARATION)].length;
}

// The runner's import, assembled so this file is not itself a Playwright file.
const RUNNER = ["@playwright", "test"].join("/");

describe("the one-test cap", () => {
  test("counts test declarations in Playwright files only", () => {
    assert.equal(playwrightTests("a.spec.ts", `import { test } from "${RUNNER}";\ntest("one", async () => {});`), 1);
    assert.equal(playwrightTests("b.ts", `import { test } from "${RUNNER}";\ntest("one", () => {});\ntest.only("two", () => {});`), 2);
    assert.equal(playwrightTests("c.mts", `import { chromium } from "${RUNNER}";\nawait chromium.launch();`), 0);
    assert.equal(playwrightTests("d.test.mts", 'import { test } from "node:test";\ntest("x", () => {});'), 0);
    assert.equal(playwrightTests("e.spec.ts", '// test("commented", () => {})\nit("real", () => {});'), 1);
  });

  test("exactly one Playwright test exists in the repository, and it is the UJ-1 skim", () => {
    const files = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z"], { encoding: "utf8" })
      .split("\0")
      .filter((path) => path !== "" && /\.(?:[cm]?[jt]sx?)$/.test(path) && !path.startsWith("node_modules/"));
    const counts = files
      .map((path) => {
        try {
          return { path, tests: playwrightTests(path, readFileSync(path, "utf8")) };
        } catch {
          return { path, tests: 0 }; // deleted in the working tree
        }
      })
      .filter(({ tests }) => tests > 0);
    assert.deepEqual(counts, [{ path: THE_TEST, tests: 1 }], "AD-18 allows exactly one Playwright test; a second needs a new AD");
  });
});
