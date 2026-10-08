// Tests for check-repo.mts. Run with: npm run test:scripts
//
// Each test builds a throwaway git repository with an invented term list,
// never the real one, and runs the script inside it.

import assert from "node:assert/strict";
import { spawnSync, execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { after, describe, test } from "node:test";
import { fileURLToPath } from "node:url";

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), "check-repo.mts");
const TERM = "zanzibarquux";
const EM_DASH = String.fromCharCode(0x2014);
const ALLOW_LIST = [
  "_bmad-output/planning-artifacts/architecture/architecture-ShahrouzPortfolio-2026-09-25/ARCHITECTURE-SPINE.md",
  "_bmad-output/planning-artifacts/architecture/architecture-ShahrouzPortfolio-2026-09-25/C4-ARCHITECTURE.md",
  "_bmad-output/planning-artifacts/briefs/brief-ShahrouzPortfolio-2026-09-23/brief.md",
  "_bmad-output/planning-artifacts/ux-designs/ux-ShahrouzPortfolio-2026-09-23/DESIGN.md",
  "_bmad-output/planning-artifacts/ux-designs/ux-ShahrouzPortfolio-2026-09-23/EXPERIENCE.md",
];

const dirs: string[] = [];
after(() => dirs.forEach((dir) => rmSync(dir, { recursive: true, force: true })));

function write(dir: string, path: string, text: string): void {
  mkdirSync(dirname(join(dir, path)), { recursive: true });
  writeFileSync(join(dir, path), text);
}

// Run from a git hook, this suite inherits variables such as GIT_INDEX_FILE.
// During `git commit -a` that is an absolute path to the real repository's
// index, and a scratch repository would write into it. Children never see
// any GIT_* variable.
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

// A repository that passes: the five approved planning files, one source
// file, a term list, one commit.
function cleanRepo(terms: string | null = `# invented terms\n${TERM}\n`): string {
  const dir = mkdtempSync(join(tmpdir(), "check-repo-"));
  dirs.push(dir);
  git(dir, "init", "-q");
  write(dir, ".gitignore", ".forbidden-terms\n");
  if (terms !== null) write(dir, ".forbidden-terms", terms);
  for (const path of ALLOW_LIST) write(dir, path, "approved\n");
  write(dir, "app/page.tsx", "export default function Page() { return null; }\n");
  commit(dir, "Initial commit");
  return dir;
}

function run(dir: string, ...args: string[]): number | null {
  return spawnSync(process.execPath, [SCRIPT, ...args], { cwd: dir, env: ISOLATED_ENV, encoding: "utf8" }).status;
}

describe("check-repo", () => {
  test("a clean repository passes, with and without --history", () => {
    const dir = cleanRepo();
    assert.equal(run(dir), 0);
    assert.equal(run(dir, "--history"), 0);
  });

  test("a term in a tracked file fails", () => {
    const dir = cleanRepo();
    write(dir, "app/page.tsx", `// ${TERM}\n`);
    git(dir, "add", "-A");
    assert.equal(run(dir), 1);
  });

  test("an em dash in a tracked file fails", () => {
    const dir = cleanRepo();
    write(dir, "README.md", `one ${EM_DASH} two\n`);
    git(dir, "add", "-A");
    assert.equal(run(dir), 1);
  });

  test("a term only in an earlier commit's content fails under --history", () => {
    const dir = cleanRepo();
    write(dir, "notes.md", `${TERM}\n`);
    commit(dir, "Add notes");
    rmSync(join(dir, "notes.md"));
    commit(dir, "Remove notes");
    assert.equal(run(dir), 0);
    assert.equal(run(dir, "--history"), 1);
  });

  test("a term on a later line of an earlier commit message fails under --history", () => {
    const dir = cleanRepo();
    commit(dir, `Subject\n\nBody line\nmentions ${TERM}`);
    commit(dir, "Later commit");
    assert.equal(run(dir, "--history"), 1);
  });

  test("a '#'-prefixed message line is scanned under --history", () => {
    const dir = cleanRepo();
    commit(dir, `Subject\n\n# ${TERM}`);
    assert.equal(run(dir, "--history"), 1);
  });

  test("a planning file off the allow-list fails", () => {
    const dir = cleanRepo();
    write(dir, "_bmad-output/planning-artifacts/epics.md", "epics\n");
    git(dir, "add", "-f", "_bmad-output/planning-artifacts/epics.md");
    assert.equal(run(dir), 1);
  });

  test("a missing term file fails", () => {
    assert.equal(run(cleanRepo(null)), 1);
  });

  test("a term file holding only comments and blank lines fails", () => {
    assert.equal(run(cleanRepo("# nothing here\n\n   \n")), 1);
  });
});
