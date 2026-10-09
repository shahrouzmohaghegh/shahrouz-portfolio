// The only supported way to change the confidential term list.
//
//   npm run terms:sync               guard, then write both GitHub secrets
//   npm run terms:sync -- --dry-run  guard only; gh is never called
//
// Prerequisite for a real run: `gh auth login` as a user with admin rights
// on the repository, since writing repository secrets needs them.
//
// CI scans every blob and commit message in history (check-repo.mts
// --history). A new term that already matches history would turn every run
// red, and the only fix would be rewriting a public history. So this script
// first fetches origin, so remote-tracking refs are current, then runs that
// same scan against the local .forbidden-terms. The list's own rules
// (missing, empty, invalid pattern) live in check-repo.mts alone. Only if the
// scan passes does it write FORBIDDEN_TERMS to the Actions and the Dependabot
// secret stores. The file reaches gh on stdin, so the terms never appear in
// arguments, output or logs.

import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { isEntryPoint } from "./entry-point.mts";

export const TERMS_FILE = ".forbidden-terms";
export const SECRET_NAME = "FORBIDDEN_TERMS";
const CHECK_REPO = join(dirname(fileURLToPath(import.meta.url)), "check-repo.mts");

// Both stores need the secret: runs triggered by Dependabot read Dependabot
// secrets, not Actions secrets (see ci.yml).
export const SECRET_STORES = ["actions", "dependabot"] as const;

export type Options = { dryRun: boolean };

export function parseArgs(argv: string[]): Options | { error: string } {
  const unknown = argv.filter((arg) => arg !== "--dry-run");
  if (unknown.length > 0) return { error: `unknown argument(s): ${unknown.join(" ")}` };
  return { dryRun: argv.includes("--dry-run") };
}

// "owner/name" from a GitHub remote URL (https, scp-style or ssh), or null.
export function repoSlug(url: string): string | null {
  const match = url.trim().match(/github\.com[:/]+([^/\s]+)\/([^/\s]+?)(?:\.git)?\/?$/);
  return match ? `${match[1]}/${match[2]}` : null;
}

export function secretArgs(store: (typeof SECRET_STORES)[number], repo: string): string[] {
  return ["secret", "set", SECRET_NAME, "--app", store, "--repo", repo];
}

const gitOut = (cwd: string, ...args: string[]) => spawnSync("git", args, { cwd, encoding: "utf8" });

export function main(argv: string[], cwd: string = process.cwd()): number {
  const fail = (message: string): number => {
    console.error(`terms-sync: nothing written. ${message}`);
    return 1;
  };
  const options = parseArgs(argv);
  if ("error" in options) return fail(options.error);

  const top = gitOut(cwd, "rev-parse", "--show-toplevel");
  if (top.status !== 0) return fail("Not inside a git repository.");
  const root = top.stdout.trim();

  // The raw configured URL, not `git remote get-url`, which applies
  // insteadOf rewriting.
  const url = gitOut(root, "config", "--get", "remote.origin.url");
  const repo = url.status === 0 ? repoSlug(url.stdout) : null;
  if (!repo) return fail("The origin remote is missing or is not a GitHub repository.");

  const fetch = spawnSync("git", ["fetch", "--prune", "--quiet", "origin"], { cwd: root, stdio: "inherit" });
  if (fetch.status !== 0) return fail("git fetch origin failed, so history on GitHub cannot be checked.");

  // check-repo prints each problem as a path or commit plus line number,
  // never the term itself.
  const guard = spawnSync(process.execPath, [CHECK_REPO, "--history"], { cwd: root, stdio: "inherit" });
  if (guard.status !== 0) return fail("check-repo failed, see above.");
  if (options.dryRun) {
    console.log("terms-sync: dry run, check-repo --history passes; no secret written");
    return 0;
  }

  const text = readFileSync(join(root, TERMS_FILE), "utf8");
  const written: string[] = [];
  for (const store of SECRET_STORES) {
    const result = spawnSync("gh", secretArgs(store, repo), { cwd: root, input: text, stdio: ["pipe", "ignore", "pipe"] });
    if (result.status !== 0) {
      const detail = result.error ? result.error.message : (result.stderr?.toString().trim() ?? "");
      console.error(
        `terms-sync: gh failed writing the ${store} secret (${detail || `exit ${result.status}`}). ` +
          `Written so far: ${written.length > 0 ? written.join(", ") : "none"}. Rerun once gh works.`,
      );
      return 1;
    }
    written.push(store);
  }
  console.log(`terms-sync: check-repo --history passes; ${SECRET_NAME} written to ${written.join(" and ")} secrets of ${repo}`);
  return 0;
}

const invokedDirectly = isEntryPoint(import.meta.url);
if (invokedDirectly) process.exit(main(process.argv.slice(2)));
