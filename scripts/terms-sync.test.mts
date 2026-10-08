// Tests for terms-sync.mts. Run with: npm run test:scripts
//
// Each CLI test builds a throwaway git repository with an invented term
// list, never the real one, and puts a fake gh first on PATH that records
// its arguments and stdin. No test touches GitHub.

import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, dirname, join } from "node:path";
import { after, describe, test } from "node:test";
import { fileURLToPath } from "node:url";

import { parseArgs, repoSlug, secretArgs } from "./terms-sync.mts";

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), "terms-sync.mts");
const TERM = "zanzibarquux";
const TERMS = `# invented terms\n${TERM}\n`;
const ALLOW_LIST = [
  "_bmad-output/planning-artifacts/architecture/architecture-ShahrouzPortfolio-2026-09-25/ARCHITECTURE-SPINE.md",
  "_bmad-output/planning-artifacts/architecture/architecture-ShahrouzPortfolio-2026-09-25/C4-ARCHITECTURE.md",
  "_bmad-output/planning-artifacts/briefs/brief-ShahrouzPortfolio-2026-09-23/brief.md",
  "_bmad-output/planning-artifacts/ux-designs/ux-ShahrouzPortfolio-2026-09-23/DESIGN.md",
  "_bmad-output/planning-artifacts/ux-designs/ux-ShahrouzPortfolio-2026-09-23/EXPERIENCE.md",
];

const dirs: string[] = [];
after(() => dirs.forEach((dir) => rmSync(dir, { recursive: true, force: true })));

function scratch(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  dirs.push(dir);
  return dir;
}

function write(dir: string, path: string, text: string): void {
  mkdirSync(dirname(join(dir, path)), { recursive: true });
  writeFileSync(join(dir, path), text);
}

// Same isolation as check-repo.test.mts: run from a git hook, this suite
// inherits GIT_* variables (such as an absolute GIT_INDEX_FILE) that would
// point scratch repositories at the real one.
const ISOLATED_ENV: NodeJS.ProcessEnv = { ...process.env };
for (const key of Object.keys(ISOLATED_ENV)) {
  if (key.startsWith("GIT_")) delete ISOLATED_ENV[key];
}

function git(dir: string, ...args: string[]): void {
  execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@example.com", "-c", "core.hooksPath=/dev/null", ...args], {
    cwd: dir,
    env: ISOLATED_ENV,
    stdio: "ignore",
  });
}

function commit(dir: string, message: string): void {
  git(dir, "add", "-A");
  git(dir, "commit", "-q", "--allow-empty", "--cleanup=verbatim", "-m", message);
}

const SLUG = "test-owner/test-repo";
const originOf = new Map<string, string>();
const ORIGIN_URL = `https://github.com/${SLUG}.git`;

// A scratch repository whose origin is a GitHub URL, rewritten by insteadOf
// to a local bare repository, so the script resolves a real-looking slug
// while every fetch stays on disk.
function repo(terms: string | null = TERMS): string {
  const bare = scratch("terms-sync-origin-");
  git(bare, "init", "-q", "--bare");
  const dir = scratch("terms-sync-");
  git(dir, "init", "-q");
  git(dir, "remote", "add", "origin", ORIGIN_URL);
  git(dir, "config", `url.${bare}.insteadOf`, ORIGIN_URL);
  originOf.set(dir, bare);
  write(dir, ".gitignore", ".forbidden-terms\n");
  if (terms !== null) write(dir, ".forbidden-terms", terms);
  for (const path of ALLOW_LIST) write(dir, path, "approved\n");
  write(dir, "app/page.tsx", "export default function Page() { return null; }\n");
  commit(dir, "Initial commit");
  git(dir, "push", "-q", "origin", "HEAD:refs/heads/main");
  return dir;
}

type Run = { status: number | null; output: string; calls: string[]; stdin: string };

// The fake gh records every call and its stdin, then exits 1 when its
// arguments contain failOn, and 0 otherwise.
function run(dir: string, args: string[] = [], failOn: string | null = null): Run {
  const bin = scratch("terms-sync-bin-");
  const log = join(bin, "calls.log");
  const stdinLog = join(bin, "stdin.log");
  const failure = failOn === null ? "" : `case "$*" in *"${failOn}"*) exit 1;; esac\n`;
  write(bin, "gh", `#!/bin/sh\nprintf '%s\\n' "$*" >> "${log}"\ncat >> "${stdinLog}"\n${failure}exit 0\n`);
  chmodSync(join(bin, "gh"), 0o755);
  const result = spawnSync(process.execPath, [SCRIPT, ...args], {
    cwd: dir,
    env: { ...ISOLATED_ENV, PATH: `${bin}${delimiter}${ISOLATED_ENV.PATH ?? ""}` },
    encoding: "utf8",
  });
  const read = (path: string): string => (existsSync(path) ? readFileSync(path, "utf8") : "");
  return {
    status: result.status,
    output: result.stdout + result.stderr,
    calls: read(log).split("\n").filter(Boolean),
    stdin: read(stdinLog),
  };
}

describe("terms-sync helpers", () => {
  test("parseArgs accepts --dry-run and nothing else", () => {
    assert.deepEqual(parseArgs([]), { dryRun: false });
    assert.deepEqual(parseArgs(["--dry-run"]), { dryRun: true });
    assert.ok("error" in parseArgs(["--force"]));
  });

  test("repoSlug reads owner/name from https, scp-style and ssh GitHub URLs", () => {
    assert.equal(repoSlug("https://github.com/owner/name.git"), "owner/name");
    assert.equal(repoSlug("https://github.com/owner/name\n"), "owner/name");
    assert.equal(repoSlug("git@github.com:owner/name.git"), "owner/name");
    assert.equal(repoSlug("ssh://git@github.com/owner/name.git"), "owner/name");
    assert.equal(repoSlug("/tmp/some/bare"), null);
  });

  test("secretArgs names the secret, the store and the repository, never a value", () => {
    assert.deepEqual(secretArgs("actions", SLUG), ["secret", "set", "FORBIDDEN_TERMS", "--app", "actions", "--repo", SLUG]);
    assert.deepEqual(secretArgs("dependabot", SLUG), [
      "secret",
      "set",
      "FORBIDDEN_TERMS",
      "--app",
      "dependabot",
      "--repo",
      SLUG,
    ]);
  });
});

describe("terms-sync CLI", () => {
  test("a safe list writes both secrets from stdin and prints no term", () => {
    const result = run(repo());
    assert.equal(result.status, 0, result.output);
    assert.deepEqual(result.calls, [
      `secret set FORBIDDEN_TERMS --app actions --repo ${SLUG}`,
      `secret set FORBIDDEN_TERMS --app dependabot --repo ${SLUG}`,
    ]);
    assert.equal(result.stdin, TERMS + TERMS);
    assert.ok(!result.output.includes(TERM));
  });

  test("run from a subdirectory, it works from the repository root", () => {
    const dir = repo();
    const result = run(join(dir, "app"));
    assert.equal(result.status, 0, result.output);
    assert.equal(result.calls.length, 2);
  });

  test("--dry-run runs the guard and never calls gh", () => {
    const result = run(repo(), ["--dry-run"]);
    assert.equal(result.status, 0, result.output);
    assert.deepEqual(result.calls, []);
  });

  test("a term in an earlier commit's content stops before gh and names the path and commit", () => {
    const dir = repo();
    write(dir, "notes.md", `${TERM}\n`);
    commit(dir, "Add notes");
    rmSync(join(dir, "notes.md"));
    commit(dir, "Remove notes");
    const result = run(dir);
    assert.equal(result.status, 1);
    assert.deepEqual(result.calls, []);
    assert.match(result.output, /history notes\.md \([0-9a-f]{7}\)/);
    assert.match(result.output, /check-repo failed, see above/);
    assert.ok(!result.output.includes(TERM));
  });

  test("a term in an earlier commit message stops before gh and names the commit", () => {
    const dir = repo();
    commit(dir, `Subject\n\nmentions ${TERM}`);
    commit(dir, "Later commit");
    const result = run(dir, ["--dry-run"]);
    assert.equal(result.status, 1);
    assert.deepEqual(result.calls, []);
    assert.match(result.output, /commit message [0-9a-f]{7}/);
  });

  test("a term only on origin, pushed from elsewhere, is fetched and stops the run", () => {
    const dir = repo();
    const other = scratch("terms-sync-other-");
    execFileSync("git", ["clone", "-q", originOf.get(dir)!, other], { env: ISOLATED_ENV, stdio: "ignore" });
    write(other, "remote-only.md", `${TERM}\n`);
    commit(other, "Add a file only origin has");
    git(other, "push", "-q", "origin", "HEAD:refs/heads/elsewhere");
    const result = run(dir, ["--dry-run"]);
    assert.equal(result.status, 1, result.output);
    assert.match(result.output, /history remote-only\.md/);
    assert.ok(!result.output.includes(TERM));
  });

  test("a failed fetch stops before the scan and before gh", () => {
    const dir = repo();
    rmSync(originOf.get(dir)!, { recursive: true, force: true });
    const result = run(dir);
    assert.equal(result.status, 1);
    assert.deepEqual(result.calls, []);
    assert.match(result.output, /git fetch origin failed/);
  });

  test("an origin that is not on GitHub stops before gh", () => {
    const dir = repo();
    git(dir, "remote", "set-url", "origin", "/tmp/not-github");
    const result = run(dir);
    assert.equal(result.status, 1);
    assert.deepEqual(result.calls, []);
  });

  test("a missing, comment-only or invalid list stops before gh and prints no term", () => {
    for (const terms of [null, "# nothing\n\n", `broken(${TERM}\n`]) {
      const result = run(repo(terms));
      assert.equal(result.status, 1);
      assert.deepEqual(result.calls, []);
      assert.ok(!result.output.includes(TERM));
    }
  });

  test("gh failing on the first store exits 1 having written nothing", () => {
    const result = run(repo(), [], "--app actions");
    assert.equal(result.status, 1);
    assert.match(result.output, /Written so far: none/);
    assert.equal(result.calls.length, 1);
  });

  test("gh failing on the Dependabot store exits 1 and reports the Actions write", () => {
    const result = run(repo(), [], "--app dependabot");
    assert.equal(result.status, 1);
    assert.match(result.output, /Written so far: actions\./);
    assert.equal(result.calls.length, 2);
  });

  test("an unknown argument exits 1 without calling gh", () => {
    const result = run(repo(), ["--force"]);
    assert.equal(result.status, 1);
    assert.deepEqual(result.calls, []);
  });
});
