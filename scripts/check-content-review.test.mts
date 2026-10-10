// Tests for check-content-review.mts. Run with: npm run test:scripts
//
// The unit tests use fixtures for the event and git. The end-to-end tests
// run the script against scratch repositories with a real event file, so
// the git and event wiring is covered too. One test reads the real pull
// request template, so the box the check reads is the box it offers.

import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { after, describe, test } from "node:test";
import { fileURLToPath } from "node:url";

import { REVIEW_CHECKBOX, check, gatedPaths, parseEvent, reviewResult, ticks, type Deps } from "./check-content-review.mts";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const SCRIPT = join(HERE, "check-content-review.mts");
const BASE = "a".repeat(40);
const HEAD = "b".repeat(40);
const LATEST = "c".repeat(7) + "d".repeat(33);
const line = (sha: string, box = "x", bullet = "-"): string => `${bullet} [${box}] Shahrouz reviewed the content wording at ${sha}`;
const TICKED = `## Content review\n\n${line("ccccccc")}\n`;
const UNTICKED = `## Content review\n\n${line("ccccccc", " ")}\n`;
const CONTENT_CHANGE = ["README.md", "content/projects/index.ts"];

function deps(eventName: string | undefined, body: string | null, files: string[], latest: string | null = LATEST) {
  const diffs: string[][] = [];
  const d: Deps = {
    env: { GITHUB_EVENT_NAME: eventName, GITHUB_EVENT_PATH: "/event.json" },
    readFile: (path) => {
      assert.equal(path, "/event.json");
      return JSON.stringify({ pull_request: { body, base: { sha: BASE }, head: { sha: HEAD } } });
    },
    changedFiles: (base, head) => {
      diffs.push([base, head]);
      return files;
    },
    latestGatedCommit: () => latest,
  };
  return { d, diffs };
}

describe("check-content-review", () => {
  test("a pull request that changes no gated path passes, whatever its body", () => {
    const { d, diffs } = deps("pull_request", null, ["README.md", "lib/evidence.ts", "contentious.md", "app/content/x.ts"]);
    const result = check(d);
    assert.equal(result.ok, true);
    assert.match(result.message, /no content review needed/);
    assert.deepEqual(diffs, [[BASE, HEAD]]);
  });

  test("a gated change ticked at a prefix of the latest gated commit passes, in any bullet or case", () => {
    for (const body of [
      TICKED,
      TICKED.replace("[x]", "[X]"),
      TICKED.replace(/\n/g, "\r\n"),
      `${line("CCCCCCCDDD", "x", "*")}\n`,
      `${line(LATEST, "x", "+")}.\n`,
    ]) {
      assert.equal(check(deps("pull_request", body, CONTENT_CHANGE).d).ok, true, JSON.stringify(body));
    }
  });

  test("lib/evidence.test.ts is gated, as content/ is", () => {
    assert.deepEqual(gatedPaths(["lib/evidence.test.ts", "lib/evidence.ts", "content/a.mdx"]), ["lib/evidence.test.ts", "content/a.mdx"]);
    assert.equal(check(deps("pull_request", UNTICKED, ["lib/evidence.test.ts"]).d).ok, false);
  });

  test("an unticked box fails and names the gated paths and the commit to name", () => {
    const result = check(deps("pull_request", UNTICKED, CONTENT_CHANGE).d);
    assert.equal(result.ok, false);
    assert.match(result.message, /no ticked "Shahrouz reviewed the content wording" box/);
    assert.match(result.message, /content\/projects\/index\.ts/);
    assert.doesNotMatch(result.message, /README\.md/);
    assert.match(result.message, /"- \[x\] Shahrouz reviewed the content wording at cccccccddddd"/);
  });

  test("a tick without a hash, or naming another commit, fails with the commit to name", () => {
    const bare = check(deps("pull_request", "- [x] Shahrouz reviewed the content wording\n", CONTENT_CHANGE).d);
    assert.equal(bare.ok, false);
    assert.match(bare.message, /names no commit[\s\S]*at cccccccddddd/);
    const placeholder = check(deps("pull_request", REVIEW_CHECKBOX.replace("[ ]", "[x]"), CONTENT_CHANGE).d);
    assert.match(placeholder.message, /names no commit/);
    const older = check(deps("pull_request", line("1234567"), CONTENT_CHANGE).d);
    assert.equal(older.ok, false);
    assert.match(older.message, /names 1234567, not cccccccddddd/);
    assert.equal(check(deps("pull_request", line("cccccc"), CONTENT_CHANGE).d).ok, false, "six hex characters is too short");
  });

  test("a box missing, quoted, commented out or inside a code fence fails", () => {
    for (const body of [
      null,
      "",
      "Small wording fix.",
      `> ${line("ccccccc")}`,
      `<!-- ${line("ccccccc")} -->`,
      `<!--\n${line("ccccccc")}\n`,
      "```\n" + line("ccccccc") + "\n```\n",
      "- [x] Shahrouz reviewed",
    ]) {
      assert.equal(check(deps("pull_request", body, CONTENT_CHANGE).d).ok, false, JSON.stringify(body));
    }
  });

  test("any other event passes and says why, without reading git", () => {
    for (const name of ["push", "workflow_dispatch", undefined]) {
      const { d, diffs } = deps(name, null, CONTENT_CHANGE);
      const result = check(d);
      assert.equal(result.ok, true);
      assert.match(result.message, /not pull_request/);
      assert.deepEqual(diffs, []);
    }
  });

  test("a pull request event without an event path, SHAs or a gated commit fails rather than passing", () => {
    const { d } = deps("pull_request", TICKED, CONTENT_CHANGE);
    assert.equal(check({ ...d, env: { GITHUB_EVENT_NAME: "pull_request" } }).ok, false);
    assert.throws(() => parseEvent(JSON.stringify({ pull_request: { base: { sha: BASE } } })), /no pull_request base and head SHA/);
    assert.throws(() => parseEvent("{}"), /no pull_request base and head SHA/);
    assert.equal(reviewResult(CONTENT_CHANGE, TICKED, null).ok, false);
  });

  test("the pull request template offers exactly the box the check reads, unticked", () => {
    const template = readFileSync(join(ROOT, ".github/pull_request_template.md"), "utf8");
    assert.ok(template.split("\n").includes(REVIEW_CHECKBOX));
    assert.deepEqual(ticks(template), []);
    const filled = template.replace(REVIEW_CHECKBOX, REVIEW_CHECKBOX.replace("[ ]", "[x]").replace("COMMIT", "abcdef1"));
    assert.deepEqual(ticks(filled), ["abcdef1"]);
  });
});

// ---------------------------------------------------------------- end to end

const dirs: string[] = [];
after(() => dirs.forEach((dir) => rmSync(dir, { recursive: true, force: true })));

// Run from a git hook, this suite inherits variables such as GIT_INDEX_FILE,
// and a scratch repository would write into the real index. Children never
// see any GIT_* variable.
const ISOLATED_ENV: NodeJS.ProcessEnv = { ...process.env };
for (const key of Object.keys(ISOLATED_ENV)) {
  if (key.startsWith("GIT_")) delete ISOLATED_ENV[key];
}

function git(dir: string, ...args: string[]): string {
  return execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@example.com", "-c", "core.hooksPath=/dev/null", ...args], {
    cwd: dir,
    env: ISOLATED_ENV,
    encoding: "utf8",
  }).trim();
}

function write(dir: string, path: string, text: string): void {
  mkdirSync(dirname(join(dir, path)), { recursive: true });
  writeFileSync(join(dir, path), text);
}

function commit(dir: string, message: string): string {
  git(dir, "add", "-A");
  git(dir, "commit", "-q", "-m", message);
  return git(dir, "rev-parse", "HEAD");
}

// A repository with one content file and a README, one commit: the base.
function cleanRepo(): { dir: string; base: string } {
  const dir = mkdtempSync(join(tmpdir(), "check-content-review-"));
  dirs.push(dir);
  git(dir, "init", "-q");
  write(dir, "content/a.mdx", "Prose.\n");
  write(dir, "README.md", "Readme.\n");
  return { dir, base: commit(dir, "Initial commit") };
}

function run(dir: string, base: string, body: string): { status: number | null; output: string } {
  const head = git(dir, "rev-parse", "HEAD");
  const eventPath = join(dir, "..", `${dir.split("/").pop()}-event.json`);
  writeFileSync(eventPath, JSON.stringify({ pull_request: { body, base: { sha: base }, head: { sha: head } } }));
  dirs.push(eventPath);
  const result = spawnSync(process.execPath, [SCRIPT], {
    cwd: dir,
    env: { ...ISOLATED_ENV, GITHUB_EVENT_NAME: "pull_request", GITHUB_EVENT_PATH: eventPath },
    encoding: "utf8",
  });
  return { status: result.status, output: result.stdout + result.stderr };
}

describe("check-content-review end to end", () => {
  test("a content change unticked exits 1", () => {
    const { dir, base } = cleanRepo();
    write(dir, "content/a.mdx", "New prose.\n");
    commit(dir, "Change content");
    const result = run(dir, base, "No box.");
    assert.equal(result.status, 1, result.output);
    assert.match(result.output, /content\/a\.mdx/);
  });

  test("a content change ticked with the latest commit's hash exits 0", () => {
    const { dir, base } = cleanRepo();
    write(dir, "content/a.mdx", "New prose.\n");
    const sha = commit(dir, "Change content");
    write(dir, "README.md", "Later readme.\n");
    commit(dir, "Change only the readme after the review");
    const result = run(dir, base, `${line(sha.slice(0, 7))}\n`);
    assert.equal(result.status, 0, result.output);
  });

  test("a tick naming an older content commit exits 1 and names the newer one", () => {
    const { dir, base } = cleanRepo();
    write(dir, "content/a.mdx", "New prose.\n");
    const older = commit(dir, "Change content");
    write(dir, "content/a.mdx", "Newer prose.\n");
    const newer = commit(dir, "Change content again");
    const result = run(dir, base, `${line(older.slice(0, 7))}\n`);
    assert.equal(result.status, 1, result.output);
    assert.ok(result.output.includes(newer.slice(0, 12)), result.output);
  });

  test("a README-only change exits 0", () => {
    const { dir, base } = cleanRepo();
    write(dir, "README.md", "New readme.\n");
    commit(dir, "Change the readme");
    const result = run(dir, base, "");
    assert.equal(result.status, 0, result.output);
  });

  test("a rename out of content/ exits 1 unticked, listing the old path", () => {
    const { dir, base } = cleanRepo();
    git(dir, "mv", "content/a.mdx", "a.mdx");
    commit(dir, "Move content out");
    const result = run(dir, base, "");
    assert.equal(result.status, 1, result.output);
    assert.match(result.output, /content\/a\.mdx/);
  });

  // The branch changes content/a.mdx and main meanwhile changes the given
  // file. Returns the branch's content commit and main's head, which is the
  // pull request's base once main is merged into the branch.
  function branchAndMain(mainPath: string, mainText: string): { dir: string; branchSha: string; mainHead: string } {
    const { dir } = cleanRepo();
    const main = git(dir, "rev-parse", "--abbrev-ref", "HEAD");
    git(dir, "checkout", "-q", "-b", "feature");
    write(dir, "content/a.mdx", "Branch prose.\n");
    const branchSha = commit(dir, "Change content on the branch");
    git(dir, "checkout", "-q", main);
    write(dir, mainPath, mainText);
    const mainHead = commit(dir, "Change content on main");
    git(dir, "checkout", "-q", "feature");
    return { dir, branchSha, mainHead };
  }

  test("a merge of main that only brings in content already on main is not the commit to name", () => {
    const { dir, branchSha, mainHead } = branchAndMain("content/b.mdx", "Main prose.\n");
    git(dir, "merge", "-q", "--no-edit", mainHead);
    const result = run(dir, mainHead, `${line(branchSha.slice(0, 7))}\n`);
    assert.equal(result.status, 0, result.output);
  });

  test("a merge resolving a content conflict with its own wording is the commit to name", () => {
    const { dir, branchSha, mainHead } = branchAndMain("content/a.mdx", "Main prose.\n");
    const conflicted = spawnSync("git", ["-c", "core.hooksPath=/dev/null", "merge", "-q", "--no-edit", mainHead], { cwd: dir, env: ISOLATED_ENV });
    assert.notEqual(conflicted.status, 0, "the merge should stop on a conflict");
    write(dir, "content/a.mdx", "Resolved prose.\n");
    const merge = commit(dir, "Merge main, resolving the content conflict");
    const result = run(dir, mainHead, `${line(branchSha.slice(0, 7))}\n`);
    assert.equal(result.status, 1, result.output);
    assert.ok(result.output.includes(merge.slice(0, 12)), result.output);
  });
});
