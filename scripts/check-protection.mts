// Fails unless main is still protected the way the gate depends on.
//
//   node scripts/check-protection.mts
//
// Branch protection is the only thing that keeps a red gate out of
// production: Vercel deploys main, and main only takes pull requests whose
// gate passed. Nothing else notices if that protection is relaxed, so the
// gate itself reads it on every run (ci.yml, after the secret scan).
//
// It reads the public branch endpoint, GET /repos/{owner}/{repo}/branches/main,
// which needs no admin token. That endpoint shows only three things, and
// exactly these are checked:
//   - protected is true;
//   - required status checks are enforced for everyone, admins included;
//   - the required checks include gate.
// The other settings (pull request required, strict up-to-date branches, no
// force push or deletion) are not visible there without an admin token, so
// they are not checked.
//
// Drift exits 1 with "has drifted:" and the list. A request that fails
// (network, timeout, a non-OK status after one retry, or a response of the
// wrong shape) exits 1 with "could not read" instead, so an outage reads
// differently from drift.
//
// The repository is GITHUB_REPOSITORY in CI (it must be owner/name),
// otherwise the origin remote. GH_TOKEN, when set, is sent to api.github.com
// only; the repository is public, so a local run works without it.
// scripts/pin-review.mts reports the same facts monthly, so relaxed
// protection is noticed on a quiet repository too.

import { spawnSync } from "node:child_process";

import { repoSlug } from "./terms-sync.mts";
import { isEntryPoint } from "./entry-point.mts";

export const BRANCH = "main";
export const REQUIRED_CHECK = "gate";
export const ENFORCEMENT = "everyone";

export type Branch = {
  protected?: boolean;
  protection?: {
    enabled?: boolean;
    required_status_checks?: {
      enforcement_level?: string;
      contexts?: string[];
      checks?: { context: string }[];
    };
  };
};

const API = "https://api.github.com";
const REPO_SLUG = /^[A-Za-z0-9-]+\/[A-Za-z0-9._-]+$/;
const TIMEOUT_MS = 30_000;

export const branchUrl = (repo: string): string => `https://api.github.com/repos/${repo}/branches/${BRANCH}`;

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

// The branch response, checked for the shape protectionProblems reads.
// Throws on anything else, so a malformed body is never read as drift.
export function parseBranch(text: string): Branch {
  const fail = (what: string): never => {
    throw new Error(`unexpected branch response: ${what}`);
  };
  const body: unknown = JSON.parse(text);
  if (!isObject(body)) return fail("not an object");
  if (typeof body.protected !== "boolean") fail("protected is not a boolean");
  if (body.protection !== undefined) {
    if (!isObject(body.protection)) fail("protection is not an object");
    const checks = (body.protection as Record<string, unknown>).required_status_checks;
    if (checks !== undefined) {
      if (!isObject(checks)) fail("required_status_checks is not an object");
      const c = checks as Record<string, unknown>;
      if (c.enforcement_level !== undefined && typeof c.enforcement_level !== "string") {
        fail("enforcement_level is not a string");
      }
      if (c.contexts !== undefined && !(Array.isArray(c.contexts) && c.contexts.every((x) => typeof x === "string"))) {
        fail("contexts is not a list of names");
      }
      if (
        c.checks !== undefined &&
        !(Array.isArray(c.checks) && c.checks.every((x) => isObject(x) && typeof x.context === "string"))
      ) {
        fail("checks is not a list of checks");
      }
    }
  }
  return body as Branch;
}

export type Reading = { state: "read"; problems: string[] } | { state: "unreadable"; reason: string };

const message = (error: unknown): string => (error instanceof Error ? error.message : String(error));

// Fetches and checks main's protection. Never rejects.
export async function readProtection(fetchText: FetchText, repo: string): Promise<Reading> {
  try {
    return { state: "read", problems: protectionProblems(parseBranch(await fetchText(branchUrl(repo)))) };
  } catch (error) {
    return { state: "unreadable", reason: message(error) };
  }
}

// What no longer holds, in plain words. Empty means protection is intact.
export function protectionProblems(branch: Branch): string[] {
  if (branch.protected !== true) return [`${BRANCH} is not protected`];
  const checks = branch.protection?.required_status_checks;
  if (!checks) return [`${BRANCH} requires no status checks`];
  const problems: string[] = [];
  const level = checks.enforcement_level ?? "missing";
  if (level !== ENFORCEMENT) {
    problems.push(`required status checks are enforced for "${level}", not "${ENFORCEMENT}", so admins are exempt`);
  }
  const required = new Set([...(checks.contexts ?? []), ...(checks.checks ?? []).map((check) => check.context)]);
  if (!required.has(REQUIRED_CHECK)) {
    const list = required.size > 0 ? [...required].join(", ") : "none";
    problems.push(`the required checks (${list}) do not include ${REQUIRED_CHECK}`);
  }
  return problems;
}

export type Env = { GITHUB_REPOSITORY?: string };

// GITHUB_REPOSITORY in CI, otherwise owner/name from the raw origin URL.
// A set GITHUB_REPOSITORY that is not owner/name gives null; the remote is
// not consulted then, since CI should never fall back to it.
export function resolveRepo(env: Env, originUrl: () => string | null): string | null {
  const fromEnv = env.GITHUB_REPOSITORY?.trim();
  if (fromEnv) return REPO_SLUG.test(fromEnv) ? fromEnv : null;
  const url = originUrl();
  return url ? repoSlug(url) : null;
}

export type FetchText = (url: string) => Promise<string>;

export type Deps = {
  fetchText: FetchText;
  env: Env;
  originUrl: () => string | null;
  err: (text: string) => void;
};

export async function main(deps: Deps): Promise<number> {
  const fail = (message: string): number => {
    deps.err(`check-protection: ${message}`);
    return 1;
  };
  const repo = resolveRepo(deps.env, deps.originUrl);
  if (!repo) {
    return fail("GITHUB_REPOSITORY is not owner/name, or is unset and the origin remote is missing or not on GitHub.");
  }
  const reading = await readProtection(deps.fetchText, repo);
  if (reading.state === "unreadable") return fail(`could not read ${BRANCH} protection of ${repo}: ${reading.reason}`);
  if (reading.problems.length === 0) return 0;
  return fail(`${BRANCH} protection of ${repo} has drifted:\n${reading.problems.map((p) => `  - ${p}`).join("\n")}`);
}

// ---------------------------------------------------------------- CLI

export type FetchImpl = (url: string, init: RequestInit) => Promise<Response>;
export type FetchOptions = { fetchImpl?: FetchImpl; token?: string; backoffMs?: number };

// GET with a 30 second timeout, retried once after a short backoff on a
// network error, a timeout or a 5xx. A non-OK status throws, so it is never
// parsed as a body. The token goes to api.github.com only.
export async function defaultFetch(url: string, options: FetchOptions = {}): Promise<string> {
  const { fetchImpl = fetch, token = process.env.GH_TOKEN, backoffMs = 2_000 } = options;
  const headers: Record<string, string> = {
    "User-Agent": "shahrouz-portfolio-check-protection",
    Accept: "application/vnd.github+json",
  };
  if (token && new URL(url).origin === API) headers.Authorization = `Bearer ${token}`;
  for (let attempt = 1; ; attempt++) {
    let response: Response;
    try {
      response = await fetchImpl(url, { headers, signal: AbortSignal.timeout(TIMEOUT_MS) });
    } catch (error) {
      if (attempt === 1) {
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
        continue;
      }
      throw new Error(`${url}: ${message(error)}`);
    }
    if (response.status >= 500 && attempt === 1) {
      await new Promise((resolve) => setTimeout(resolve, backoffMs));
      continue;
    }
    if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
    return response.text();
  }
}

// The raw configured URL, as terms-sync.mts reads it, not `git remote
// get-url`, which applies insteadOf rewriting.
export function defaultOriginUrl(): string | null {
  const result = spawnSync("git", ["config", "--get", "remote.origin.url"], { encoding: "utf8" });
  return result.status === 0 ? result.stdout.trim() : null;
}

const invokedDirectly = isEntryPoint(import.meta.url);
if (invokedDirectly) {
  main({
    fetchText: (url) => defaultFetch(url),
    env: { GITHUB_REPOSITORY: process.env.GITHUB_REPOSITORY },
    originUrl: defaultOriginUrl,
    err: (text) => console.error(text),
  }).then(
    (code) => process.exit(code),
    (error: unknown) => {
      console.error(`check-protection: ${message(error)}`);
      process.exit(1);
    },
  );
}
