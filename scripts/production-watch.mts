// Watches production and keeps one GitHub issue open while anything is
// wrong, so a failure reaches Shahrouz by GitHub's own email before a
// visitor reports it. Run four times an hour by
// .github/workflows/production-watch.yml.
//
//   node scripts/production-watch.mts                     check, then open, comment on or close the issue
//   node scripts/production-watch.mts --print             check and print the result; no issue is touched
//   node scripts/production-watch.mts --simulate-failure  as above, with the apex check failed on purpose
//
// Issues are touched only when GITHUB_ACTIONS is "true"; anywhere else the
// script behaves as --print, so a local run can never open or close one.
//
// One pass runs five checks:
//   - apex: https://shahrouzmohaghegh.com/ answers 200 and its HTML
//     contains "Shahrouz Mohaghegh";
//   - www, http: https://www.shahrouzmohaghegh.com/ and
//     http://shahrouzmohaghegh.com/ each answer 308 to the apex;
//   - http-www: http://www.shahrouzmohaghegh.com/ answers 308 to the apex,
//     directly or via https://www (which the www check covers);
//   - deployment: the newest GitHub deployment in environment Production
//     (Vercel creates them) has success, in_progress, queued or pending as
//     its latest status, and has not sat in one of the last three for over
//     30 minutes. failure, error, any other state, no status, no deployment,
//     or an API request that fails are all problems.
// Redirects are never followed, so the 308 itself is what is read. Every
// request has a 20 second timeout.
//
// Opening and closing are confirmed the same way: three passes, 60 seconds
// apart. A check counts as failing only when it failed on all three, so a
// blip raises nothing; with an issue open, it is closed only after three
// clean passes. Mixed results count as nothing this run. The detail
// reported is the one from the last pass. --simulate-failure skips the
// retries and marks the apex failed for this run only, to prove the alert
// path end to end; the next scheduled run then closes the issue.
//
// Ownership. In a public repository anyone can open an issue or comment, so
// only what the GitHub Actions bot wrote counts: an open issue is ours when
// the bot opened it and it carries the hidden marker or the title
// "Production is down", and markers are read only from bot comments.
// Candidates are found with two searches (title, marker); each one's
// comments are read in full with `gh api --paginate`.
//
// With problems and none open, "Production is down" is created listing them,
// assigned to the repository owner and labelled "production". With one
// open, a comment is added only when the set of failing checks differs from
// the last one the bot recorded; a changed detail alone, such as 502
// becoming 503, adds nothing. Older open ones are closed as duplicates of
// the newest. On recovery every open one is closed with a "Recovered"
// comment, which is skipped when the bot's latest comment already is one,
// so a retried close does not repeat it. A failed gh call exits 1, so the
// workflow run fails and GitHub emails about that instead.
//
// GH_TOKEN, when set, is sent to api.github.com only. Built-ins only, so
// the workflow needs no npm ci.

import { spawnSync } from "node:child_process";

import { defaultOriginUrl, resolveRepo } from "./check-protection.mts";
import { isEntryPoint } from "./entry-point.mts";

export const ISSUE_TITLE = "Production is down";
export const LABEL = "production";
export const NAME = "Shahrouz Mohaghegh";
export const APEX = "https://shahrouzmohaghegh.com/";
export const WWW = "https://www.shahrouzmohaghegh.com/";
export const HTTP = "http://shahrouzmohaghegh.com/";
export const HTTP_WWW = "http://www.shahrouzmohaghegh.com/";
export const ENVIRONMENT = "Production";
export const HEALTHY_STATES = ["success", "in_progress", "queued", "pending"];
export const PASSES = 3;
export const RETRY_MS = 60_000;
export const TIMEOUT_MS = 20_000;
export const STUCK_MS = 30 * 60_000;
// The author of anything the workflow's token writes, as each API names it.
export const BOT_ISSUE_AUTHOR = "app/github-actions";
export const BOT_COMMENT_LOGIN = "github-actions[bot]";

const API = "https://api.github.com";
const MARKER_TEXT = "production-watch problems";
const MARKER_PREFIX = `<!-- ${MARKER_TEXT}: `;
const MARKER = /<!-- production-watch problems: (.*?) -->/g;
const RECOVERED = "Recovered at ";

export const deploymentsUrl = (repo: string): string =>
  `${API}/repos/${repo}/deployments?environment=${ENVIRONMENT}&per_page=1`;
export const statusesUrl = (repo: string, id: number): string =>
  `${API}/repos/${repo}/deployments/${id}/statuses?per_page=1`;
export const emergencyUrl = (repo: string): string => `https://github.com/${repo}/blob/main/README.md#emergency-path`;

// ---------------------------------------------------------------- checks

export const CHECK_IDS = ["apex", "www", "http", "http-www", "deployment"] as const;
export type CheckId = (typeof CHECK_IDS)[number];
export type Problem = { check: CheckId; detail: string };

export const CHECK_LABELS: Record<CheckId, string> = {
  apex: `${APEX} answers 200 and contains "${NAME}"`,
  www: `${WWW} answers 308 to ${APEX}`,
  http: `${HTTP} answers 308 to ${APEX}`,
  "http-www": `${HTTP_WWW} answers 308 to ${APEX} or ${WWW}`,
  deployment: `the latest ${ENVIRONMENT} deployment is success, or in_progress, queued or pending for under ${STUCK_MS / 60_000} minutes`,
};

// One request, never following a redirect. Rejects on a network error or
// timeout; any HTTP status, 4xx and 5xx included, resolves.
export type HttpResponse = { status: number; location: string | null; body: string };
export type Http = (url: string) => Promise<HttpResponse>;

const errorText = (error: unknown): string => (error instanceof Error ? error.message : String(error));

export async function checkApex(http: Http): Promise<Problem | null> {
  let response: HttpResponse;
  try {
    response = await http(APEX);
  } catch (error) {
    return { check: "apex", detail: `${APEX} did not answer: ${errorText(error)}` };
  }
  if (response.status !== 200) return { check: "apex", detail: `${APEX} answered HTTP ${response.status}, not 200` };
  if (!response.body.includes(NAME)) {
    return { check: "apex", detail: `${APEX} answered 200, but the page does not contain "${NAME}"` };
  }
  return null;
}

// The Location is resolved against the request URL, so a relative or
// non-canonical one that lands on an accepted target passes.
export async function checkRedirect(
  http: Http,
  check: "www" | "http" | "http-www",
  url: string,
  accepted: string[] = [APEX],
): Promise<Problem | null> {
  let response: HttpResponse;
  try {
    response = await http(url);
  } catch (error) {
    return { check, detail: `${url} did not answer: ${errorText(error)}` };
  }
  const wanted = `308 to ${accepted.join(" or ")}`;
  if (response.location === null) {
    return { check, detail: `${url} answered HTTP ${response.status} with no Location, not ${wanted}` };
  }
  let target: string;
  try {
    target = new URL(response.location, url).href;
  } catch {
    return { check, detail: `${url} answered HTTP ${response.status} with an unparseable Location, not ${wanted}` };
  }
  if (response.status === 308 && accepted.includes(target)) return null;
  return { check, detail: `${url} answered HTTP ${response.status} with Location ${target}, not ${wanted}` };
}

async function readJson(http: Http, url: string): Promise<unknown> {
  const response = await http(url);
  if (response.status !== 200) throw new Error(`${url}: HTTP ${response.status}`);
  return JSON.parse(response.body) as unknown;
}

export async function checkDeployment(http: Http, repo: string | null, now: Date): Promise<Problem | null> {
  const problem = (detail: string): Problem => ({ check: "deployment", detail });
  if (!repo) return problem("repository unknown: no GITHUB_REPOSITORY and no GitHub origin remote");
  try {
    const deployments = await readJson(http, deploymentsUrl(repo));
    if (!Array.isArray(deployments)) throw new Error("deployments response is not a list");
    if (deployments.length === 0) return problem(`no ${ENVIRONMENT} deployment found in ${repo}`);
    const deployment = deployments[0] as { id?: unknown; sha?: unknown };
    if (typeof deployment.id !== "number") throw new Error("deployment has no numeric id");
    const sha = typeof deployment.sha === "string" ? ` (commit ${deployment.sha.slice(0, 7)})` : "";
    const statuses = await readJson(http, statusesUrl(repo, deployment.id));
    if (!Array.isArray(statuses)) throw new Error("statuses response is not a list");
    const latest = statuses[0] as { state?: unknown; target_url?: unknown; created_at?: unknown } | undefined;
    if (!latest || typeof latest.state !== "string") {
      return problem(`the latest ${ENVIRONMENT} deployment${sha} has no status`);
    }
    const log = typeof latest.target_url === "string" && latest.target_url !== "" ? `; log: ${latest.target_url}` : "";
    if (!HEALTHY_STATES.includes(latest.state)) {
      return problem(`the latest ${ENVIRONMENT} deployment${sha} is "${latest.state}"${log}`);
    }
    const since = typeof latest.created_at === "string" ? Date.parse(latest.created_at) : NaN;
    if (latest.state !== "success" && !Number.isNaN(since) && now.getTime() - since > STUCK_MS) {
      const at = new Date(since).toISOString();
      return problem(
        `the latest ${ENVIRONMENT} deployment${sha} has been "${latest.state}" since ${at}, over ${STUCK_MS / 60_000} minutes${log}`,
      );
    }
    return null;
  } catch (error) {
    return problem(`could not read ${ENVIRONMENT} deployments: ${errorText(error)}`);
  }
}

// One pass: every check, problems in CHECK_IDS order. Never rejects.
export async function checkOnce(http: Http, repo: string | null, now: Date): Promise<Problem[]> {
  const results = await Promise.all([
    checkApex(http),
    checkRedirect(http, "www", WWW),
    checkRedirect(http, "http", HTTP),
    checkRedirect(http, "http-www", HTTP_WWW, [APEX, WWW]),
    checkDeployment(http, repo, now),
  ]);
  return results.filter((result): result is Problem => result !== null);
}

export type Sleep = (ms: number) => Promise<void>;
export type Verdict =
  | { state: "clean"; passes: number }
  | { state: "problems"; problems: Problem[]; simulated: boolean }
  | { state: "inconclusive"; last: Problem[] };

export type WatchContext = {
  http: Http;
  repo: string | null;
  sleep: Sleep;
  now: () => Date;
  log?: (text: string) => void;
};

export const SIMULATED: Problem = {
  check: "apex",
  detail: "simulated failure (--simulate-failure); the real apex check was not counted this run",
};

// Up to PASSES passes, RETRY_MS apart. Problems count only when the same
// checks failed on every pass. With an issue open, clean also needs every
// pass: one clean pass is enough only when there is nothing to close.
export async function watch(
  ctx: WatchContext,
  options: { issueOpen: boolean; simulate?: boolean } = { issueOpen: false },
): Promise<Verdict> {
  const log = ctx.log ?? (() => {});
  if (options.simulate) {
    const real = (await checkOnce(ctx.http, ctx.repo, ctx.now())).filter((p) => p.check !== "apex");
    return { state: "problems", problems: [SIMULATED, ...real], simulated: true };
  }
  let persistent: Problem[] = [];
  let allClean = true;
  for (let pass = 1; pass <= PASSES; pass++) {
    if (pass > 1) {
      log(
        allClean
          ? `pass ${pass - 1} clean; confirming before closing, again in ${RETRY_MS / 1000}s`
          : `pass ${pass - 1} found ${persistent.map((p) => p.check).join(", ")}; checking again in ${RETRY_MS / 1000}s`,
      );
      await ctx.sleep(RETRY_MS);
    }
    const result = await checkOnce(ctx.http, ctx.repo, ctx.now());
    allClean &&= result.length === 0;
    persistent = pass === 1 ? result : result.filter((p) => persistent.some((q) => q.check === p.check));
    if (allClean && !options.issueOpen) return { state: "clean", passes: pass };
    if (!allClean && persistent.length === 0) return { state: "inconclusive", last: result };
  }
  return allClean ? { state: "clean", passes: PASSES } : { state: "problems", problems: persistent, simulated: false };
}

// ---------------------------------------------------------------- report

export function report(verdict: Verdict): string {
  const shown = verdict.state === "problems" ? verdict.problems : verdict.state === "inconclusive" ? verdict.last : [];
  const failed = new Map(shown.map((p) => [p.check, p.detail]));
  const lines = CHECK_IDS.map((id) => {
    const detail = failed.get(id);
    return detail === undefined ? `pass  ${CHECK_LABELS[id]}` : `FAIL  ${CHECK_LABELS[id]}\n      ${detail}`;
  });
  const summary =
    verdict.state === "clean"
      ? verdict.passes > 1
        ? `Every check passes, on ${verdict.passes} passes.`
        : "Every check passes."
      : verdict.state === "inconclusive"
        ? "Results changed between passes (last pass shown); nothing counts this run."
        : verdict.simulated
          ? "Apex failure simulated for this run; other checks from one pass."
          : `${verdict.problems.length} check(s) failed on all ${PASSES} passes, ${RETRY_MS / 1000}s apart.`;
  return `${lines.join("\n")}\n${summary}\n`;
}

// ---------------------------------------------------------------- issue

export const keyOf = (problems: Problem[]): string =>
  CHECK_IDS.filter((id) => problems.some((p) => p.check === id)).join(",");

const markerLine = (problems: Problem[]): string => `${MARKER_PREFIX}${keyOf(problems)} -->`;
const problemList = (problems: Problem[]): string[] => problems.map((p) => `- **${p.check}**: ${p.detail}`);
const keysIn = (text: string): string[] => [...text.matchAll(MARKER)].map((m) => m[1]);

export function issueBody(problems: Problem[], now: Date, repo: string): string {
  return [
    markerLine(problems),
    "<!-- Written by scripts/production-watch.mts (.github/workflows/production-watch.yml). -->",
    "",
    `These production checks failed, as of ${now.toISOString()}:`,
    "",
    ...problemList(problems),
    "",
    `A check counts only after failing on ${PASSES} passes, ${RETRY_MS / 1000} seconds apart. ` +
      "The watch comments here when the set of failing checks changes, and closes this issue with a " +
      `"Recovered" comment after ${PASSES} clean passes.`,
    "",
    `To restore the site quickly, see the [emergency path](${emergencyUrl(repo)}). ` +
      "After a Vercel instant rollback the site recovers, but the deployment problem stays until a new deploy " +
      "succeeds, because the latest commit on main is not what is live.",
    "",
  ].join("\n");
}

export function changeComment(problems: Problem[], now: Date): string {
  return [
    markerLine(problems),
    "",
    `The failing checks changed. As of ${now.toISOString()}:`,
    "",
    ...problemList(problems),
    "",
  ].join("\n");
}

export const recoveredComment = (now: Date): string =>
  `${RECOVERED}${now.toISOString()}: every production check passed on ${PASSES} passes.`;

export type Author = { login: string; is_bot?: boolean } | null;
export type ListedIssue = { number: number; title: string; body: string; author: Author };
export type Comment = { body: string; login: string | null; type: string | null };
export type OwnedIssue = { number: number; body: string; comments: Comment[] };

export const isBotIssue = (issue: ListedIssue): boolean =>
  issue.author?.is_bot === true && issue.author.login === BOT_ISSUE_AUTHOR;
export const isBotComment = (comment: Comment): boolean =>
  comment.login === BOT_COMMENT_LOGIN && comment.type === "Bot";

// Opened by the bot, and carrying the marker or the title, so a bot issue
// whose marker was edited away still counts.
export const isOurs = (issue: ListedIssue): boolean =>
  isBotIssue(issue) && (keysIn(issue.body).length > 0 || issue.title === ISSUE_TITLE);

// The failing checks the bot last recorded: its latest marked comment, else
// the body. null when neither carries a marker.
export function recordedKey(issue: OwnedIssue): string | null {
  const fromComments = issue.comments.filter(isBotComment).flatMap((comment) => keysIn(comment.body));
  if (fromComments.length > 0) return fromComments[fromComments.length - 1];
  const fromBody = keysIn(issue.body);
  return fromBody.length > 0 ? fromBody[fromBody.length - 1] : null;
}

const lastBotCommentIsRecovered = (issue: OwnedIssue): boolean =>
  issue.comments.filter(isBotComment).at(-1)?.body.startsWith(RECOVERED) ?? false;

export type Action =
  | { kind: "create"; problems: Problem[] }
  | { kind: "comment"; number: number; problems: Problem[] }
  | { kind: "recover"; number: number; postComment: boolean }
  | { kind: "duplicate"; number: number; of: number };

// What to do with our open issues, given this run's verdict.
export function planIssues(verdict: Verdict, ours: OwnedIssue[]): Action[] {
  if (verdict.state === "inconclusive") return [];
  const sorted = [...ours].sort((a, b) => b.number - a.number);
  if (verdict.state === "clean") {
    return sorted.map((issue) => ({ kind: "recover", number: issue.number, postComment: !lastBotCommentIsRecovered(issue) }));
  }
  const [newest, ...older] = sorted;
  if (!newest) return [{ kind: "create", problems: verdict.problems }];
  const actions: Action[] =
    recordedKey(newest) === keyOf(verdict.problems)
      ? []
      : [{ kind: "comment", number: newest.number, problems: verdict.problems }];
  return [...actions, ...older.map((issue): Action => ({ kind: "duplicate", number: issue.number, of: newest.number }))];
}

export type Gh = (args: string[], input?: string) => string;

// gh prints nothing at all, not "[]", for some empty --json lists (seen with
// `gh label list --search` matching no label), so empty output is an empty list.
export function parseList<T>(json: string): T[] {
  return json.trim() === "" ? [] : (JSON.parse(json) as T[]);
}

// Open issues the bot owns, each with every comment.
export function findOwnIssues(gh: Gh, repo: string): OwnedIssue[] {
  const listed = new Map<number, ListedIssue>();
  for (const search of [`"${ISSUE_TITLE}" in:title`, `"${MARKER_TEXT}" in:body`]) {
    const json = gh([
      "issue", "list", "--repo", repo, "--state", "open", "--search", search,
      "--limit", "100", "--json", "number,title,body,author",
    ]);
    for (const issue of parseList<ListedIssue>(json)) listed.set(issue.number, issue);
  }
  return [...listed.values()].filter(isOurs).map((issue) => ({
    number: issue.number,
    body: issue.body,
    comments: gh([
      "api", "--paginate", `repos/${repo}/issues/${issue.number}/comments`,
      "--jq", ".[] | {body: .body, login: .user.login, type: .user.type}",
    ])
      .split("\n")
      .filter((line) => line.trim() !== "")
      .map((line) => JSON.parse(line) as Comment),
  }));
}

function ensureLabel(gh: Gh, repo: string): void {
  const labels = parseList<{ name: string }>(
    gh(["label", "list", "--repo", repo, "--search", LABEL, "--limit", "100", "--json", "name"]),
  );
  if (labels.some((label) => label.name.toLowerCase() === LABEL)) return;
  gh(["label", "create", LABEL, "--repo", repo, "--color", "B60205", "--description", "Production health, from the production watch"]);
}

// Applies the plan through gh; bodies go on stdin.
export function applyPlan(actions: Action[], gh: Gh, repo: string, now: Date): string[] {
  if (actions.length === 0) return ["no change"];
  return actions.map((action) => {
    switch (action.kind) {
      case "create":
        ensureLabel(gh, repo);
        gh(
          ["issue", "create", "--repo", repo, "--title", ISSUE_TITLE, "--body-file", "-",
            "--label", LABEL, "--assignee", repo.split("/")[0]],
          issueBody(action.problems, now, repo),
        );
        return "created the issue";
      case "comment":
        gh(["issue", "comment", String(action.number), "--repo", repo, "--body-file", "-"], changeComment(action.problems, now));
        return `commented on issue #${action.number}: the failing checks changed`;
      case "recover":
        if (action.postComment) {
          gh(["issue", "comment", String(action.number), "--repo", repo, "--body-file", "-"], recoveredComment(now));
        }
        gh(["issue", "close", String(action.number), "--repo", repo, "--reason", "completed"]);
        return `closed issue #${action.number}: recovered`;
      case "duplicate":
        gh([
          "issue", "close", String(action.number), "--repo", repo, "--reason", "not planned",
          "--comment", `Duplicate of #${action.of}, which tracks the current production problems.`,
        ]);
        return `closed issue #${action.number} as a duplicate of #${action.of}`;
    }
  });
}

// ---------------------------------------------------------------- CLI

export type FetchImpl = (url: string, init: RequestInit) => Promise<Response>;
export type HttpOptions = { fetchImpl?: FetchImpl; token?: string };

// GET with a TIMEOUT_MS timeout covering the body too, redirects not
// followed. The token goes to api.github.com only.
export async function defaultHttp(url: string, options: HttpOptions = {}): Promise<HttpResponse> {
  const { fetchImpl = fetch, token = process.env.GH_TOKEN } = options;
  const headers: Record<string, string> = { "User-Agent": "shahrouz-portfolio-production-watch" };
  if (new URL(url).origin === API) {
    headers.Accept = "application/vnd.github+json";
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  const response = await fetchImpl(url, { headers, redirect: "manual", signal: AbortSignal.timeout(TIMEOUT_MS) });
  return { status: response.status, location: response.headers.get("location"), body: await response.text() };
}

export type Spawn = (
  command: string,
  args: string[],
  options: { input?: string; encoding: "utf8"; maxBuffer: number },
) => { status: number | null; stdout: string; stderr: string; error?: Error };

// gh through spawn; a non-zero exit or a spawn error throws, naming the
// subcommand.
export function makeGh(spawn: Spawn = (command, args, options) => spawnSync(command, args, options)): Gh {
  return (args, input) => {
    const result = spawn("gh", args, { input, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
    if (result.error || result.status !== 0) {
      const name = args.filter((arg) => !arg.startsWith("-")).slice(0, 2).join(" ");
      throw new Error(`gh ${name} failed: ${result.error?.message ?? (result.stderr.trim() || `exit ${result.status}`)}`);
    }
    return result.stdout;
  };
}

export type Deps = {
  http: Http;
  gh: Gh;
  sleep: Sleep;
  now: () => Date;
  repo: () => string | null;
  env: { GITHUB_ACTIONS?: string };
  out: (text: string) => void;
  err: (text: string) => void;
};

const FLAGS = ["--print", "--simulate-failure"];

// Exit 0 once the issues match the verdict. When only printing, the exit is
// 1 when problems count. Rejects on a gh failure.
export async function main(argv: string[], deps: Deps): Promise<number> {
  const unknown = argv.filter((arg) => !FLAGS.includes(arg));
  if (unknown.length > 0) {
    deps.err(`production-watch: unknown argument(s): ${unknown.join(" ")}`);
    return 1;
  }
  const inActions = deps.env.GITHUB_ACTIONS === "true";
  const printOnly = argv.includes("--print") || !inActions;
  if (!argv.includes("--print") && !inActions) {
    deps.err("production-watch: not running in GitHub Actions, so no issue is touched; printing only");
  }
  const repo = deps.repo();
  let ours: OwnedIssue[] = [];
  if (!printOnly) {
    if (!repo) throw new Error("repository unknown, so the issue cannot be read");
    ours = findOwnIssues(deps.gh, repo);
  }
  const verdict = await watch(
    { http: deps.http, repo, sleep: deps.sleep, now: deps.now, log: (text) => deps.err(`production-watch: ${text}`) },
    { issueOpen: ours.length > 0, simulate: argv.includes("--simulate-failure") },
  );
  deps.out(report(verdict));
  if (printOnly || !repo) return verdict.state === "problems" ? 1 : 0;
  for (const line of applyPlan(planIssues(verdict, ours), deps.gh, repo, deps.now())) {
    deps.err(`production-watch: ${line}`);
  }
  return 0;
}

const invokedDirectly = isEntryPoint(import.meta.url);
if (invokedDirectly) {
  main(process.argv.slice(2), {
    http: (url) => defaultHttp(url),
    gh: makeGh(),
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    now: () => new Date(),
    repo: () => resolveRepo({ GITHUB_REPOSITORY: process.env.GITHUB_REPOSITORY }, defaultOriginUrl),
    env: { GITHUB_ACTIONS: process.env.GITHUB_ACTIONS },
    out: (text) => process.stdout.write(text),
    err: (text) => console.error(text),
  }).then(
    (code) => process.exit(code),
    (error: unknown) => {
      console.error(`production-watch: ${errorText(error)}`);
      process.exit(1);
    },
  );
}
