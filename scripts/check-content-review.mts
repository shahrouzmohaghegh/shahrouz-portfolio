// Fails a pull request that changes reviewed content unless its body says
// Shahrouz reviewed the wording as of the latest commit that changed it.
//
//   node scripts/check-content-review.mts   (npm run check:content-review)
//
// Content is what a reader judges Shahrouz by, and confidentiality is
// binding on every word of it, so a content change merges only once he has
// reviewed the wording himself. The gated paths are everything under
// content/ and lib/evidence.test.ts, which holds his reviewed lists (the
// unqualified metrics and the display order). The pull request template
// carries the checklist and the box; this check reads the box only.
//
// The box is tied to a commit: the accepted line is
//   - [x] Shahrouz reviewed the content wording at <sha>
// where <sha> (7 to 40 hex characters) is a prefix of the latest commit in
// the pull request that touched a gated path. A later content push makes an
// old tick stale, and the failure names the commit to review and name. A
// tick inside an HTML comment or a fenced code block does not count.
//
// This is a procedural check, not an identity check: agents act through
// Shahrouz's login, so GitHub cannot tell who ticked the box. The agent
// never ticks it.
//
// On a pull_request event it reads GITHUB_EVENT_PATH for the base and head
// SHAs and the body, and reads the full-depth checkout with git. Every other
// event passes and says why: CI runs on pull requests and on pushes to main,
// and main takes changes only by pull request. CI triggers on edited pull
// requests too, so ticking the box re-runs the gate with the new body; a
// re-run of an old job would read the old body.

import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

import { withoutFences } from "./check-readme.mts";
import { isEntryPoint } from "./entry-point.mts";

export const CONTENT_DIR = "content/";
export const REVIEWED_LISTS = "lib/evidence.test.ts";
export const REVIEW_LINE = "Shahrouz reviewed the content wording";
export const REVIEW_CHECKBOX = `- [ ] ${REVIEW_LINE} at COMMIT`;

const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const LINE_PATTERN = escapeRegExp(REVIEW_LINE).replace(/ /g, "[ \\t]+");
// A ticked box with this line, at the start of a line, with any list bullet.
// Group 1 is whatever follows the line, so a tick without a hash is seen.
const TICKED = new RegExp(`^[ \\t]*[-*+][ \\t]+\\[[xX]\\][ \\t]+${LINE_PATTERN}(.*?)\\r?$`, "gm");
const AT_SHA = /^[ \t]+at[ \t]+([0-9a-fA-F]{7,40})[ \t]*\.?[ \t]*$/;

export type Result = { ok: boolean; message: string };

export type PullRequestEvent = { pull_request?: { body?: string | null; base?: { sha?: string }; head?: { sha?: string } } };

export const isGated = (path: string): boolean => path.startsWith(CONTENT_DIR) || path === REVIEWED_LISTS;

export const gatedPaths = (files: readonly string[]): string[] => files.filter(isGated);

// The body with HTML comments (an unclosed one runs to the end) and fenced
// code blocks removed, so an example or a commented-out tick never counts.
export const visibleText = (body: string): string => withoutFences(body.replace(/<!--[\s\S]*?(-->|$)/g, ""));

// Every ticked review line in the body: the named SHA in lower case, or null
// for a tick that names none.
export function ticks(body: string | null | undefined): (string | null)[] {
  return [...visibleText(body ?? "").matchAll(TICKED)].map((match) => {
    const sha = AT_SHA.exec(match[1]);
    return sha ? sha[1].toLowerCase() : null;
  });
}

// The verdict for a pull request, from its changed files, its body and the
// latest commit in it that touched a gated path.
export function reviewResult(changedFiles: readonly string[], body: string | null | undefined, latest: string | null): Result {
  const gated = gatedPaths(changedFiles);
  if (gated.length === 0) {
    return { ok: true, message: `no file under ${CONTENT_DIR} and no ${REVIEWED_LISTS} changed; no content review needed` };
  }
  const list = gated.map((path) => `  ${path}`).join("\n");
  if (latest === null) {
    return { ok: false, message: `reviewed content changed but no commit in the range touched it:\n${list}` };
  }
  const short = latest.slice(0, 12);
  const wanted = `"- [x] ${REVIEW_LINE} at ${short}"`;
  const found = ticks(body);
  if (found.some((sha) => sha !== null && latest.toLowerCase().startsWith(sha))) {
    return { ok: true, message: `reviewed content changed and the review box names ${short}, its latest change:\n${list}` };
  }
  const why =
    found.length === 0
      ? `the pull request body has no ticked "${REVIEW_LINE}" box`
      : found.every((sha) => sha === null)
        ? "the ticked review box names no commit"
        : `the ticked review box names ${found.filter((sha) => sha !== null).join(", ")}, not ${short}, the latest commit to change reviewed content`;
  return {
    ok: false,
    message:
      `reviewed content changed and ${why}:\n${list}\n` +
      `Once Shahrouz has reviewed the wording as of ${short}, the body needs the line ${wanted}; ` +
      "the template line is in .github/pull_request_template.md.",
  };
}

// The base and head SHAs and body of a pull_request event payload.
export function parseEvent(text: string): { base: string; head: string; body: string | null } {
  const event = JSON.parse(text) as PullRequestEvent;
  const base = event.pull_request?.base?.sha;
  const head = event.pull_request?.head?.sha;
  const sha = /^[0-9a-f]{40}$/;
  if (!base || !sha.test(base) || !head || !sha.test(head)) {
    throw new Error("the event payload has no pull_request base and head SHA");
  }
  return { base, head, body: event.pull_request?.body ?? null };
}

export type Deps = {
  env: Record<string, string | undefined>;
  readFile: (path: string) => string;
  // The files changed on head since it left base.
  changedFiles: (base: string, head: string) => string[];
  // The latest commit on head, not on base, that touched a gated path.
  latestGatedCommit: (base: string, head: string) => string | null;
};

export function check(deps: Deps): Result {
  const eventName = deps.env.GITHUB_EVENT_NAME;
  if (eventName !== "pull_request") {
    return {
      ok: true,
      message: `event is ${eventName ?? "not set (not in GitHub Actions)"}, not pull_request; only a pull request has a body to carry the content review box`,
    };
  }
  const path = deps.env.GITHUB_EVENT_PATH;
  if (!path) return { ok: false, message: "GITHUB_EVENT_PATH is not set, so the pull request cannot be read" };
  const event = parseEvent(deps.readFile(path));
  const changed = deps.changedFiles(event.base, event.head);
  const latest = gatedPaths(changed).length > 0 ? deps.latestGatedCommit(event.base, event.head) : null;
  return reviewResult(changed, event.body, latest);
}

function git(args: string[]): string {
  const result = spawnSync("git", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (result.status !== 0) {
    throw new Error(`git ${args.join(" ")} failed: ${result.error?.message ?? result.stderr.trim()}`);
  }
  return result.stdout;
}

// Three dots: changes on head since its merge base with base, so a commit
// that reached main after the branch was cut is not counted. No renames, so
// a move out of content/ lists both paths.
const gitChangedFiles = (base: string, head: string): string[] =>
  git(["diff", "--name-only", "--no-renames", "-z", `${base}...${head}`]).split("\0").filter(Boolean);

const gitLatestGatedCommit = (base: string, head: string): string | null =>
  git(["log", "-1", "--no-renames", "--format=%H", `${base}..${head}`, "--", CONTENT_DIR, REVIEWED_LISTS]).trim() || null;

if (isEntryPoint(import.meta.url)) {
  try {
    const result = check({
      env: process.env,
      readFile: (path) => readFileSync(path, "utf8"),
      changedFiles: gitChangedFiles,
      latestGatedCommit: gitLatestGatedCommit,
    });
    (result.ok ? console.log : console.error)(`check-content-review: ${result.message}`);
    process.exit(result.ok ? 0 : 1);
  } catch (error) {
    console.error(`check-content-review: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}
