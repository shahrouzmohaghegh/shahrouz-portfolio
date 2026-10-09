// Tests for check-readme.mts. Run with: npm run test:scripts
//
// The README, package.json and ci.yml are fixtures, except for the CLI tests,
// which run the script against a temporary git repository.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, test } from "node:test";
import { fileURLToPath } from "node:url";

import {
  checksProblems,
  dependencyProblems,
  dependencyRows,
  gateStepNames,
  git,
  headingSlugs,
  linkProblems,
  linkTargets,
  main,
  packageNames,
  resolveTarget,
  scriptNames,
  section,
  withoutCode,
  type Deps,
} from "./check-readme.mts";

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), "check-readme.mts");

const PACKAGES = ["next", "typescript"];

const readmeWith = (rows: string, extra = ""): string =>
  ["# Title", "", "## Dependencies", "", "| Package | Why |", "| --- | --- |", rows, "", "## Next", "", extra].join("\n");

const JUSTIFIED = readmeWith("| `next` | The framework. |\n| `typescript` | Strict types. |");

describe("package.json", () => {
  test("reads all four dependency groups, once each", () => {
    const text = JSON.stringify({
      dependencies: { next: "1" },
      devDependencies: { typescript: "5" },
      peerDependencies: { react: "19", next: "1" },
      optionalDependencies: { fsevents: "2" },
      scripts: { a: "b" },
    });
    assert.deepEqual(packageNames(text), ["next", "typescript", "react", "fsevents"]);
  });

  test("tolerates missing groups", () => {
    assert.deepEqual(packageNames("{}"), []);
    assert.deepEqual(scriptNames("{}"), []);
  });

  test("reads script names", () => {
    assert.deepEqual(scriptNames(JSON.stringify({ scripts: { lint: "eslint", "check:readme": "x" } })), ["lint", "check:readme"]);
  });
});

describe("gateStepNames", () => {
  const CI = [
    "jobs:",
    "  other:",
    "    steps:",
    "      - name: Not this",
    "  gate:",
    "    runs-on: ubuntu-latest",
    "    steps:",
    "      - name: Lint",
    "        run: npm run lint",
    "",
    "      # a comment",
    '      - name: "Quoted step"',
    "      - run: echo unnamed",
    "      - name: 'Single (quoted)'",
    "  after:",
    "    steps:",
    "      - name: Nor this",
  ].join("\n");

  test("reads the gate job's step names only, unquoted", () => {
    assert.deepEqual(gateStepNames(CI), ["Lint", "Quoted step", "Single (quoted)"]);
  });

  test("a missing job gives none", () => {
    assert.deepEqual(gateStepNames("jobs:\n  build:\n"), []);
  });
});

describe("withoutCode", () => {
  test("removes fences of three or more backticks or tildes", () => {
    assert.equal(withoutCode("a\n````\n[x](x.md)\n```\n[y](y.md)\n````\nb"), "a\n\n\n\n\n\nb");
    assert.equal(withoutCode("a\n~~~~ md\n[x](x.md)\n~~~~\nb"), "a\n\n\n\nb");
  });

  test("a backtick fence is not closed by tildes", () => {
    assert.equal(withoutCode("```\n~~~\n[x](x.md)\n```\nb"), "\n\n\n\nb");
  });

  test("removes indented fences", () => {
    assert.equal(withoutCode("- item\n    ```sh\n    [x](x.md)\n    ```\nb"), "- item\n\n\n\nb");
  });

  test("an unclosed fence runs to the end of the file", () => {
    assert.equal(withoutCode("a\n```\n[x](x.md)\n## Heading"), "a\n\n\n");
  });

  test("removes single and double backtick spans", () => {
    assert.equal(withoutCode("a `[x](x.md)` b ``[y](y.md) ` z`` c"), "a  b  c");
  });
});

describe("section", () => {
  test("a heading inside a fence is not a section", () => {
    assert.equal(section("```\n## Dependencies\n```\n", "Dependencies"), null);
  });

  test("runs to the next level-two heading, past level three", () => {
    assert.deepEqual(section("## A\nx\n### B\ny\n## C\nz", "A"), ["x", "### B", "y"]);
  });
});

describe("dependencyRows", () => {
  test("reads rows, stripping backticks, skipping header and separator", () => {
    assert.deepEqual(dependencyRows(JUSTIFIED), [
      { name: "next", reason: "The framework." },
      { name: "typescript", reason: "Strict types." },
    ]);
  });

  test("reads only the first table of the section", () => {
    const readme = readmeWith("| `next` | The framework. |", "").replace(
      "## Next",
      "Other:\n\n| Tool | What |\n| --- | --- |\n| `zod` | Not a row. |\n\n## Next",
    );
    assert.deepEqual(dependencyRows(readme), [{ name: "next", reason: "The framework." }]);
  });

  test("honours an escaped pipe in a reason", () => {
    assert.deepEqual(dependencyRows(readmeWith("| `next` | Pages \\| routes. |")), [{ name: "next", reason: "Pages | routes." }]);
  });

  test("handles scoped package names", () => {
    assert.deepEqual(dependencyRows(readmeWith("| `@types/node` | Node types. |")), [{ name: "@types/node", reason: "Node types." }]);
  });
});

describe("dependencyProblems", () => {
  test("every package justified passes", () => {
    assert.deepEqual(dependencyProblems(JUSTIFIED, PACKAGES), []);
  });

  test("a new dependency without a row is named", () => {
    assert.deepEqual(dependencyProblems(JUSTIFIED, [...PACKAGES, "zod"]), ["zod: in package.json but has no row in the Dependencies table"]);
  });

  test("an empty or missing reason is named", () => {
    for (const row of ["| `next` |  |", "| `next` |"]) {
      const readme = readmeWith(`${row}\n| \`typescript\` | Strict types. |`);
      assert.deepEqual(dependencyProblems(readme, PACKAGES), ["next: the Dependencies table gives no reason"], row);
    }
  });

  test("a stale row for a removed package is named", () => {
    const readme = readmeWith("| `next` | The framework. |\n| `typescript` | Strict types. |\n| `left-pad` | Gone. |");
    assert.deepEqual(dependencyProblems(readme, PACKAGES), ["left-pad: has a row in the Dependencies table but is not in package.json"]);
  });

  test("a duplicate row is named", () => {
    const readme = readmeWith("| `next` | The framework. |\n| `typescript` | Strict types. |\n| `next` | Again. |");
    assert.deepEqual(dependencyProblems(readme, PACKAGES), ["next: has 2 rows in the Dependencies table"]);
  });

  test("a missing Dependencies section is named", () => {
    assert.deepEqual(dependencyProblems("# Title\n", PACKAGES), ['README.md has no "## Dependencies" section']);
  });
});

describe("checksProblems", () => {
  const CHECKS = [
    "## Checks",
    "",
    "- `npm run lint`: lints.",
    "- `npm run build`: builds.",
    "",
    "1. **Lint**: `npm run lint`.",
    "2. **Build**: `npm run build`.",
    "",
    "## After",
  ].join("\n");

  test("every script and step listed passes", () => {
    assert.deepEqual(checksProblems(CHECKS, ["lint", "build"], ["Lint", "Build"]), []);
  });

  test("a script or step missing from the README is named", () => {
    assert.deepEqual(checksProblems(CHECKS, ["lint", "build", "dev"], ["Lint", "Build", "Deploy"]), [
      'npm script "dev": in package.json but not listed under Checks',
      'gate step "Deploy": in .github/workflows/ci.yml but not listed under Checks',
    ]);
  });

  test("a listed script or step that does not exist is named", () => {
    assert.deepEqual(checksProblems(CHECKS, ["lint"], ["Lint"]), [
      'npm script "build": listed under Checks but not in package.json',
      'gate step "Build": listed under Checks but not in .github/workflows/ci.yml',
    ]);
  });

  test("a missing Checks section is named", () => {
    assert.deepEqual(checksProblems("# Title\n", [], []), ['README.md has no "## Checks" section']);
  });
});

describe("linkTargets", () => {
  test("inline links and images, with titles and angle brackets", () => {
    const md = '[a](a.md) ![i](i.png "Title") [b](<b c.md>) [d](d.md \'t\') [e](e.md (t))';
    assert.deepEqual(linkTargets(md), ["a.md", "i.png", "b c.md", "d.md", "e.md"]);
  });

  test("one level of nested brackets: an image inside a link", () => {
    assert.deepEqual(linkTargets("[![alt](img.png)](page.md)"), ["img.png", "page.md"]);
  });

  test("reference-style definitions, but not footnotes", () => {
    assert.deepEqual(linkTargets('[x][ref]\n\n[ref]: ref.md "Title"\n[other]: <o p.md>\n[^1]: a footnote'), ["ref.md", "o p.md"]);
  });

  test("HTML href and src attributes", () => {
    assert.deepEqual(linkTargets('<a href="h.md">x</a> <img src=\'s.png\'> <img src=u.png>'), ["h.md", "s.png", "u.png"]);
  });

  test("links inside code are not links", () => {
    const md = "See [a](a.md).\n\n```sh\n[b](b.md)\n```\n\nAnd `[c](c.md)` too.";
    assert.deepEqual(linkTargets(md), ["a.md"]);
  });
});

describe("resolveTarget", () => {
  test("relative paths from the root, query dropped, fragment kept", () => {
    assert.deepEqual(resolveTarget("./scripts/a.mts?x=1#L3"), { path: "scripts/a.mts", fragment: "L3" });
    assert.deepEqual(resolveTarget("docs%20x/a.md"), { path: "docs x/a.md", fragment: null });
    assert.deepEqual(resolveTarget("#checks"), { path: null, fragment: "checks" });
  });

  test("external links are ignored", () => {
    for (const target of ["https://example.com/a.md", "http://x", "mailto:a@b.c", "//cdn.example.com/x"]) {
      assert.equal(resolveTarget(target), null, target);
    }
  });

  test("a malformed percent escape is an error", () => {
    assert.deepEqual(resolveTarget("a%2.md"), { error: "malformed percent escape" });
    assert.deepEqual(resolveTarget("#a%zz"), { error: "malformed percent escape" });
  });
});

describe("headingSlugs", () => {
  test("slugs as GitHub does, repeats suffixed", () => {
    const md = "# Title\n## One-time setup after cloning\n## `npm` and [links](x.md)!\n## Notes\n## Notes\n```\n## Not a heading\n```";
    assert.deepEqual([...headingSlugs(md)], ["title", "one-time-setup-after-cloning", "npm-and-links", "notes", "notes-1"]);
  });
});

describe("linkProblems", () => {
  const README = "# Title\n\n## Checks\n\n";

  test("a link to a tracked file passes", () => {
    assert.deepEqual(linkProblems("[a](scripts/a.mts)", new Set(["scripts/a.mts"])), []);
  });

  test("a link to a missing or untracked path, or a directory, is named", () => {
    assert.deepEqual(linkProblems("[a](scripts/missing.mts) [d](scripts)", new Set(["scripts/a.mts"])), [
      "scripts/missing.mts: link points to scripts/missing.mts, which is not a tracked file",
      "scripts: link points to scripts, which is not a tracked file",
    ]);
  });

  test("each link form is checked", () => {
    const md = `${README}[r][x]\n\n[x]: ref.md\n\n<a href="h.md">h</a>\n\n[![i](i.png)](n.md)\n\n[t](<t.md> "T")`;
    assert.deepEqual(
      linkProblems(md, new Set()).map((p) => p.split(":")[0]),
      ["i.png", "n.md", "t.md", "ref.md", "h.md"],
    );
  });

  test("a bare or README.md anchor must match a heading", () => {
    const md = `${README}[ok](#checks) [ok2](README.md#title) [bad](#nope) [bad2](./README.md#missing)`;
    assert.deepEqual(linkProblems(md, new Set(["README.md"])), [
      "#nope: no heading in README.md has the anchor #nope",
      "./README.md#missing: no heading in README.md has the anchor #missing",
    ]);
  });

  test("an anchor on another file is not checked", () => {
    assert.deepEqual(linkProblems("[a](a.md#whatever)", new Set(["a.md"])), []);
  });

  test("a malformed percent escape is named", () => {
    assert.deepEqual(linkProblems("[a](a%2.md)", new Set()), ["a%2.md: malformed percent escape"]);
  });

  test("an external link is not checked", () => {
    assert.deepEqual(linkProblems("[site](https://shahrouzmohaghegh.com)", new Set()), []);
  });
});

const CI_FIXTURE = "jobs:\n  gate:\n    steps:\n      - name: Lint\n        run: npm run lint\n";
const README_FIXTURE = `${JUSTIFIED.replace("## Next", "## Checks\n\n- `npm run lint`: lints.\n\n1. **Lint**: lints.\n\n## Next")}\n[spine](a/SPINE.md)\n`;
const PKG = { scripts: { lint: "eslint" }, dependencies: { next: "1" }, devDependencies: { typescript: "5" } };

describe("main", () => {
  const run = (readme: string, pkg: object, tracked: string[]) => {
    const errors: string[] = [];
    const files: Record<string, string> = {
      "README.md": readme,
      "package.json": JSON.stringify(pkg),
      ".github/workflows/ci.yml": CI_FIXTURE,
    };
    const deps: Deps = { readFile: (path) => files[path], trackedFiles: () => tracked, err: (t) => errors.push(t) };
    return { code: main(deps), errors };
  };

  test("a consistent README exits 0 silently", () => {
    assert.deepEqual(run(README_FIXTURE, PKG, ["a/SPINE.md"]), { code: 0, errors: [] });
  });

  test("every problem is named and the exit is 1", () => {
    const result = run(README_FIXTURE, { ...PKG, devDependencies: { typescript: "5", eslint: "9" } }, []);
    assert.equal(result.code, 1);
    assert.equal(result.errors.length, 1);
    assert.match(result.errors[0], /2 problem\(s\)/);
    assert.match(result.errors[0], /eslint: in package\.json but has no row/);
    assert.match(result.errors[0], /a\/SPINE\.md: link points to a\/SPINE\.md/);
  });
});

describe("git", () => {
  test("a spawn failure reports its real cause", () => {
    assert.throws(() => git(["status"], "/nonexistent/check-readme-dir"), /could not run: .*ENOENT/);
  });
});

describe("CLI", () => {
  // The pre-commit hook exports GIT_DIR, GIT_INDEX_FILE and friends; drop
  // them so every git call here sees only the temporary repository.
  const env = (): NodeJS.ProcessEnv => {
    const copy = { ...process.env };
    for (const key of Object.keys(copy)) if (key.startsWith("GIT_")) delete copy[key];
    return copy;
  };
  const repo = (): string => {
    const dir = mkdtempSync(join(tmpdir(), "check-readme-"));
    const sh = (...args: string[]) => spawnSync("git", args, { cwd: dir, encoding: "utf8", env: env() });
    sh("init", "-q");
    mkdirSync(join(dir, ".github/workflows"), { recursive: true });
    writeFileSync(join(dir, ".github/workflows/ci.yml"), CI_FIXTURE);
    writeFileSync(join(dir, "package.json"), JSON.stringify(PKG));
    writeFileSync(join(dir, "README.md"), README_FIXTURE);
    mkdirSync(join(dir, "a"));
    writeFileSync(join(dir, "a/SPINE.md"), "spine\n");
    sh("add", "-A");
    return dir;
  };
  const run = (cwd: string, script: string, ...args: string[]) =>
    spawnSync(process.execPath, [script, ...args], { cwd, encoding: "utf8", env: env() });

  test("passes from a subdirectory, resolving paths from the root", () => {
    const dir = repo();
    try {
      const result = run(join(dir, "a"), SCRIPT);
      assert.equal(result.status, 0, result.stderr);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("--staged reads the index, the default reads the working tree", () => {
    const dir = repo();
    try {
      writeFileSync(join(dir, "package.json"), JSON.stringify({ ...PKG, dependencies: { next: "1", zod: "3" } }));
      const tree = run(dir, SCRIPT);
      assert.equal(tree.status, 1);
      assert.match(tree.stderr, /zod: in package\.json/);
      assert.equal(run(dir, SCRIPT, "--staged").status, 0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("an unknown argument exits 1", () => {
    const dir = repo();
    try {
      const result = run(dir, SCRIPT, "--nope");
      assert.equal(result.status, 1);
      assert.match(result.stderr, /unknown argument --nope/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("a symlinked invocation still runs the check", () => {
    const dir = repo();
    try {
      writeFileSync(join(dir, "package.json"), JSON.stringify({ ...PKG, dependencies: { next: "1", zod: "3" } }));
      const link = join(dir, "link.mts");
      symlinkSync(SCRIPT, link);
      const result = run(dir, link);
      assert.equal(result.status, 1);
      assert.match(result.stderr, /zod/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
