// Tests for production-watch.mts. Run with: npm run test:scripts
//
// Every response is a fixture: the HTTP layer, gh, spawn, sleep and the
// clock are fakes, so no test touches the network or GitHub. One suite
// walks the I/O matrix in the story spec row by row, asserting the issue
// action.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  APEX,
  BOT_COMMENT_LOGIN,
  BOT_ISSUE_AUTHOR,
  CHECK_IDS,
  HTTP,
  HTTP_WWW,
  ISSUE_TITLE,
  LABEL,
  NAME,
  PASSES,
  RETRY_MS,
  STUCK_MS,
  TIMEOUT_MS,
  WWW,
  changeComment,
  checkApex,
  checkDeployment,
  checkRedirect,
  defaultHttp,
  deploymentsUrl,
  emergencyUrl,
  findOwnIssues,
  issueBody,
  keyOf,
  main,
  makeGh,
  planIssues,
  recordedKey,
  recoveredComment,
  report,
  statusesUrl,
  watch,
  type Comment,
  type Deps,
  type Gh,
  type Http,
  type HttpResponse,
  type ListedIssue,
  type OwnedIssue,
  type Problem,
  type Spawn,
} from "./production-watch.mts";

const REPO = "owner/site";
const NOW = new Date("2026-10-09T12:00:00Z");
const DEPLOY_ID = 42;

// ---------------------------------------------------------------- fixtures

type Answer = HttpResponse | Error;
type Site = { apex?: Answer; www?: Answer; http?: Answer; httpWww?: Answer; deployments?: Answer; statuses?: Answer };

const ok = (body: string): HttpResponse => ({ status: 200, location: null, body });
const redirect = (status: number, location: string | null): HttpResponse => ({ status, location, body: "" });
const json = (value: unknown, status = 200): HttpResponse => ({ status, location: null, body: JSON.stringify(value) });
const deployState = (state: string, createdAt = NOW.toISOString()): HttpResponse =>
  json([{ state, target_url: "https://vercel.com/log", created_at: createdAt }]);

const HEALTHY: Required<Site> = {
  apex: ok(`<html><h1>${NAME}</h1></html>`),
  www: redirect(308, APEX),
  http: redirect(308, APEX),
  httpWww: redirect(308, WWW),
  deployments: json([{ id: DEPLOY_ID, sha: "abcdef1234567" }]),
  statuses: deployState("success"),
};

function fakeHttp(site: Site): Http {
  const merged = { ...HEALTHY, ...site };
  const routes: Record<string, Answer> = {
    [APEX]: merged.apex,
    [WWW]: merged.www,
    [HTTP]: merged.http,
    [HTTP_WWW]: merged.httpWww,
    [deploymentsUrl(REPO)]: merged.deployments,
    [statusesUrl(REPO, DEPLOY_ID)]: merged.statuses,
  };
  return async (url) => {
    const answer = routes[url];
    if (answer === undefined) throw new Error(`unexpected request: ${url}`);
    if (answer instanceof Error) throw answer;
    return answer;
  };
}

// A different site on each pass; the last one repeats.
function passesHttp(sites: Site[]): { http: Http; next: () => void } {
  let pass = 0;
  return {
    http: (url) => fakeHttp(sites[Math.min(pass, sites.length - 1)])(url),
    next: () => {
      pass++;
    },
  };
}

const BOT: ListedIssue["author"] = { login: BOT_ISSUE_AUTHOR, is_bot: true };
const botComment = (body: string): Comment => ({ body, login: BOT_COMMENT_LOGIN, type: "Bot" });
const userComment = (body: string): Comment => ({ body, login: "someone", type: "User" });

type FakeIssue = ListedIssue & { comments: Comment[] };

const botIssue = (number: number, problems: Problem[], comments: Comment[] = []): FakeIssue => ({
  number,
  title: ISSUE_TITLE,
  body: issueBody(problems, NOW, REPO),
  author: BOT,
  comments,
});

type GhCall = { args: string[]; input?: string };

// Answers every gh call the script makes. Both searches return every open
// issue, so a duplicate across them is exercised too.
function fakeGh(issues: FakeIssue[], labels: string[] = [LABEL]): { gh: Gh; calls: GhCall[] } {
  const calls: GhCall[] = [];
  const gh: Gh = (args, input) => {
    calls.push({ args, input });
    if (args[0] === "issue" && args[1] === "list") {
      return JSON.stringify(issues.map((i) => ({ number: i.number, title: i.title, body: i.body, author: i.author })));
    }
    if (args[0] === "api") {
      const number = Number(args[2].match(/issues\/(\d+)\/comments/)?.[1]);
      const issue = issues.find((i) => i.number === number);
      return (issue?.comments ?? []).map((c) => JSON.stringify(c)).join("\n") + "\n";
    }
    if (args[0] === "label" && args[1] === "list") return JSON.stringify(labels.map((name) => ({ name })));
    return "";
  };
  return { gh, calls };
}

const READS = new Set(["issue list", "api --paginate", "label list"]);
const writes = (calls: GhCall[]): GhCall[] => calls.filter((call) => !READS.has(call.args.slice(0, 2).join(" ")));

function deps(sites: Site[], issues: FakeIssue[] = [], labels?: string[]) {
  const { http, next } = passesHttp(sites);
  const { gh, calls } = fakeGh(issues, labels);
  const sleeps: number[] = [];
  const out: string[] = [];
  const err: string[] = [];
  const d: Deps = {
    http,
    gh,
    sleep: async (ms) => {
      sleeps.push(ms);
      next();
    },
    now: () => NOW,
    repo: () => REPO,
    env: { GITHUB_ACTIONS: "true" },
    out: (text) => out.push(text),
    err: (text) => err.push(text),
  };
  return { d, calls, sleeps, out, err };
}

const ctx = (sites: Site[]) => {
  const t = deps(sites);
  return { ...t, c: { http: t.d.http, repo: REPO, sleep: t.d.sleep, now: t.d.now } };
};

const APEX_DOWN: Site = { apex: { status: 503, location: null, body: "" } };
const apexProblem: Problem = { check: "apex", detail: "x" };
const deployProblem: Problem = { check: "deployment", detail: "y" };

// ---------------------------------------------------------------- checks

describe("checkApex", () => {
  test("200 containing the name passes", async () => {
    assert.equal(await checkApex(fakeHttp({})), null);
  });
  test("a non-200 status is named", async () => {
    for (const status of [500, 503, 404]) {
      const problem = await checkApex(fakeHttp({ apex: { status, location: null, body: NAME } }));
      assert.match(problem?.detail ?? "", new RegExp(`HTTP ${status}`));
    }
  });
  test("a redirect on the apex is a problem, not followed", async () => {
    assert.equal((await checkApex(fakeHttp({ apex: redirect(308, WWW) })))?.check, "apex");
  });
  test("200 without the name is named as the wrong page", async () => {
    const problem = await checkApex(fakeHttp({ apex: ok("<html>Welcome to nginx</html>") }));
    assert.match(problem?.detail ?? "", /does not contain "Shahrouz Mohaghegh"/);
  });
  test("a timeout is named, not thrown", async () => {
    const problem = await checkApex(fakeHttp({ apex: new Error("The operation was aborted due to timeout") }));
    assert.match(problem?.detail ?? "", /did not answer: .*timeout/);
  });
});

describe("checkRedirect", () => {
  test("308 with an absolute canonical Location passes", async () => {
    assert.equal(await checkRedirect(fakeHttp({}), "www", WWW), null);
  });
  test("308 with a Location that resolves to the apex passes: no trailing slash, protocol-relative", async () => {
    for (const location of ["https://shahrouzmohaghegh.com", "//shahrouzmohaghegh.com/"]) {
      assert.equal(await checkRedirect(fakeHttp({ www: redirect(308, location) }), "www", WWW), null, location);
    }
  });
  test("a relative Location resolves against the request URL, so / on www is not the apex", async () => {
    const problem = await checkRedirect(fakeHttp({ www: redirect(308, "/") }), "www", WWW);
    assert.match(problem?.detail ?? "", /Location https:\/\/www\.shahrouzmohaghegh\.com\//);
  });
  test("200, 307, 301 or a 308 elsewhere is named", async () => {
    for (const answer of [ok(NAME), redirect(307, APEX), redirect(308, "https://example.com/"), redirect(301, APEX)]) {
      const problem = await checkRedirect(fakeHttp({ www: answer }), "www", WWW);
      assert.equal(problem?.check, "www");
      assert.match(problem?.detail ?? "", new RegExp(`HTTP ${answer.status}`));
    }
  });
  test("308 with no Location is named", async () => {
    assert.match((await checkRedirect(fakeHttp({ http: redirect(308, null) }), "http", HTTP))?.detail ?? "", /no Location/);
  });
  test("a malformed Location is named as unparseable, not as no answer", async () => {
    const problem = await checkRedirect(fakeHttp({ www: redirect(308, "http://[bad") }), "www", WWW);
    assert.match(problem?.detail ?? "", /answered HTTP 308 with an unparseable Location/);
  });
  test("a network error is named", async () => {
    const problem = await checkRedirect(fakeHttp({ www: new Error("getaddrinfo ENOTFOUND") }), "www", WWW);
    assert.match(problem?.detail ?? "", /did not answer: getaddrinfo ENOTFOUND/);
  });
  test("http://www passes to the apex directly or via https://www, nowhere else", async () => {
    const check = (answer: HttpResponse) => checkRedirect(fakeHttp({ httpWww: answer }), "http-www", HTTP_WWW, [APEX, WWW]);
    assert.equal(await check(redirect(308, WWW)), null);
    assert.equal(await check(redirect(308, APEX)), null);
    assert.equal((await check(redirect(308, "http://www.shahrouzmohaghegh.com/x")))?.check, "http-www");
    assert.equal((await check(ok(NAME)))?.check, "http-www");
  });
});

describe("checkDeployment", () => {
  test("success, in_progress, queued and pending pass", async () => {
    for (const state of ["success", "in_progress", "queued", "pending"]) {
      assert.equal(await checkDeployment(fakeHttp({ statuses: deployState(state) }), REPO, NOW), null, state);
    }
  });
  test("queued, pending or in_progress for over 30 minutes is stuck; success never is", async () => {
    const old = new Date(NOW.getTime() - STUCK_MS - 1000).toISOString();
    const recent = new Date(NOW.getTime() - STUCK_MS + 1000).toISOString();
    for (const state of ["queued", "pending", "in_progress"]) {
      const problem = await checkDeployment(fakeHttp({ statuses: deployState(state, old) }), REPO, NOW);
      assert.match(problem?.detail ?? "", new RegExp(`has been "${state}" since .* over 30 minutes`));
      assert.equal(await checkDeployment(fakeHttp({ statuses: deployState(state, recent) }), REPO, NOW), null);
    }
    assert.equal(await checkDeployment(fakeHttp({ statuses: deployState("success", old) }), REPO, NOW), null);
  });
  test("failure and error are named with the commit and log", async () => {
    for (const state of ["failure", "error"]) {
      const problem = await checkDeployment(fakeHttp({ statuses: deployState(state) }), REPO, NOW);
      assert.equal(problem?.check, "deployment");
      assert.match(problem?.detail ?? "", new RegExp(`\\(commit abcdef1\\) is "${state}"; log: https://vercel.com/log`));
    }
  });
  test("any other state is a problem", async () => {
    assert.match((await checkDeployment(fakeHttp({ statuses: deployState("inactive") }), REPO, NOW))?.detail ?? "", /"inactive"/);
  });
  test("no deployment and no status are problems", async () => {
    assert.match((await checkDeployment(fakeHttp({ deployments: json([]) }), REPO, NOW))?.detail ?? "", /no Production deployment/);
    assert.match((await checkDeployment(fakeHttp({ statuses: json([]) }), REPO, NOW))?.detail ?? "", /has no status/);
  });
  test("an API outage, an HTTP error or a malformed body is a problem, not a crash", async () => {
    const cases: Site[] = [
      { deployments: new Error("fetch failed") },
      { deployments: json({ message: "Server Error" }, 502) },
      { deployments: { status: 200, location: null, body: "<html>" } },
      { deployments: json({ not: "a list" }) },
      { statuses: json({ message: "rate limited" }, 403) },
    ];
    for (const site of cases) {
      const problem = await checkDeployment(fakeHttp(site), REPO, NOW);
      assert.match(problem?.detail ?? "", /could not read Production deployments/);
    }
  });
  test("an unknown repository is a problem", async () => {
    assert.match((await checkDeployment(fakeHttp({}), null, NOW))?.detail ?? "", /repository unknown/);
  });
});

// ---------------------------------------------------------------- passes

describe("watch", () => {
  test("with no issue open, a clean first pass does not retry", async () => {
    const { c, sleeps } = ctx([{}]);
    assert.deepEqual(await watch(c, { issueOpen: false }), { state: "clean", passes: 1 });
    assert.deepEqual(sleeps, []);
  });
  test("with an issue open, clean needs every pass, a minute apart", async () => {
    const { c, sleeps } = ctx([{}]);
    assert.deepEqual(await watch(c, { issueOpen: true }), { state: "clean", passes: PASSES });
    assert.deepEqual(sleeps, Array(PASSES - 1).fill(RETRY_MS));
  });
  test("with an issue open, a failure on a later pass makes it inconclusive", async () => {
    const { c } = ctx([{}, {}, APEX_DOWN]);
    assert.equal((await watch(c, { issueOpen: true })).state, "inconclusive");
  });
  test("a problem on every pass counts, after two retries a minute apart", async () => {
    const { c, sleeps } = ctx([APEX_DOWN]);
    const verdict = await watch(c, { issueOpen: false });
    assert.equal(verdict.state, "problems");
    assert.deepEqual(verdict.state === "problems" && verdict.problems.map((p) => p.check), ["apex"]);
    assert.deepEqual(sleeps, Array(PASSES - 1).fill(RETRY_MS));
    assert.equal(RETRY_MS, 60_000);
  });
  test("a problem that clears on any pass does not count", async () => {
    for (const sites of [[APEX_DOWN, {}], [APEX_DOWN, APEX_DOWN, {}]]) {
      const { c } = ctx(sites);
      assert.equal((await watch(c, { issueOpen: false })).state, "inconclusive");
    }
  });
  test("only checks failing on all passes count, with the last detail", async () => {
    const { c } = ctx([
      { ...APEX_DOWN, www: redirect(307, APEX) },
      { apex: { status: 502, location: null, body: "" } },
      { apex: { status: 504, location: null, body: "" }, http: ok("") },
    ]);
    const verdict = await watch(c, { issueOpen: false });
    assert.ok(verdict.state === "problems");
    assert.deepEqual(verdict.problems.map((p) => p.check), ["apex"]);
    assert.match(verdict.problems[0].detail, /HTTP 504/);
  });
  test("simulate marks the apex failed in one pass, no retries, keeping other real problems", async () => {
    const { c, sleeps } = ctx([{ www: ok(NAME) }]);
    const verdict = await watch(c, { issueOpen: false, simulate: true });
    assert.ok(verdict.state === "problems" && verdict.simulated);
    assert.deepEqual(verdict.problems.map((p) => p.check), ["apex", "www"]);
    assert.match(verdict.problems[0].detail, /simulated failure/);
    assert.deepEqual(sleeps, []);
  });
});

// ---------------------------------------------------------------- ownership

describe("findOwnIssues", () => {
  test("a forged issue carrying the marker and title, opened by a user, is not ours", () => {
    const forged: FakeIssue = { ...botIssue(5, [apexProblem]), author: { login: "mallory", is_bot: false } };
    const fakeBot: FakeIssue = { ...botIssue(6, [apexProblem]), author: { login: "app/other-bot", is_bot: true } };
    assert.deepEqual(findOwnIssues(fakeGh([forged, fakeBot]).gh, REPO), []);
  });
  test("a bot issue counts by marker, or by title once its marker is edited away", () => {
    const edited: FakeIssue = { ...botIssue(8, [apexProblem]), body: "marker removed" };
    const other: FakeIssue = { ...botIssue(9, [apexProblem]), title: "Dependency pins to review", body: "no marker" };
    assert.deepEqual(findOwnIssues(fakeGh([botIssue(7, [apexProblem]), edited, other]).gh, REPO).map((i) => i.number), [7, 8]);
  });
  test("searches title and marker in open issues, merges them, and reads comments paginated", () => {
    const { gh, calls } = fakeGh([botIssue(7, [apexProblem], [userComment("hi")])]);
    const [issue] = findOwnIssues(gh, REPO);
    assert.deepEqual(issue.comments, [userComment("hi")]);
    const searches = calls.filter((c) => c.args[1] === "list").map((c) => c.args[c.args.indexOf("--search") + 1]);
    assert.deepEqual(searches, [`"${ISSUE_TITLE}" in:title`, `"production-watch problems" in:body`]);
    assert.ok(calls.every((c) => c.args[1] !== "list" || c.args.includes("open")));
    assert.deepEqual(calls.at(-1)?.args.slice(0, 3), ["api", "--paginate", `repos/${REPO}/issues/7/comments`]);
  });
});

describe("recordedKey", () => {
  test("a forged user comment carrying a marker is ignored", () => {
    const issue: OwnedIssue = { number: 7, body: issueBody([apexProblem], NOW, REPO), comments: [userComment(changeComment([deployProblem], NOW))] };
    assert.equal(recordedKey(issue), "apex");
  });
  test("the latest bot comment's marker wins over the body", () => {
    const issue: OwnedIssue = {
      number: 7,
      body: issueBody([apexProblem], NOW, REPO),
      comments: [botComment(changeComment([deployProblem], NOW)), userComment("a human remark")],
    };
    assert.equal(recordedKey(issue), "deployment");
  });
});

// ---------------------------------------------------------------- planning

const owned = (number: number, problems: Problem[], comments: Comment[] = []): OwnedIssue => ({
  number,
  body: issueBody(problems, NOW, REPO),
  comments,
});
const problemsVerdict = (problems: Problem[]) => ({ state: "problems" as const, problems, simulated: false });

describe("planIssues", () => {
  test("clean with none open: nothing", () => {
    assert.deepEqual(planIssues({ state: "clean", passes: 1 }, []), []);
  });
  test("inconclusive: nothing, even with an issue open", () => {
    assert.deepEqual(planIssues({ state: "inconclusive", last: [] }, [owned(7, [apexProblem])]), []);
  });
  test("problems with none open: create", () => {
    assert.deepEqual(planIssues(problemsVerdict([apexProblem]), []), [{ kind: "create", problems: [apexProblem] }]);
  });
  test("same failing checks: nothing, even if the detail changed", () => {
    assert.deepEqual(planIssues(problemsVerdict([{ check: "apex", detail: "HTTP 503" }]), [owned(7, [apexProblem])]), []);
  });
  test("a forged comment cannot silence a change", () => {
    const issue = owned(7, [apexProblem], [userComment(changeComment([apexProblem, deployProblem], NOW))]);
    assert.equal(planIssues(problemsVerdict([apexProblem, deployProblem]), [issue])[0]?.kind, "comment");
  });
  test("changed failing checks: comment on the newest, close older ones as duplicates", () => {
    assert.deepEqual(planIssues(problemsVerdict([deployProblem]), [owned(4, [apexProblem]), owned(9, [apexProblem])]), [
      { kind: "comment", number: 9, problems: [deployProblem] },
      { kind: "duplicate", number: 4, of: 9 },
    ]);
  });
  test("recovery closes every open one", () => {
    assert.deepEqual(planIssues({ state: "clean", passes: 3 }, [owned(4, [apexProblem]), owned(9, [apexProblem])]), [
      { kind: "recover", number: 9, postComment: true },
      { kind: "recover", number: 4, postComment: true },
    ]);
  });
  test("no second Recovered comment when the bot's latest comment already is one", () => {
    const issue = owned(7, [apexProblem], [botComment(recoveredComment(NOW)), userComment("still open?")]);
    assert.deepEqual(planIssues({ state: "clean", passes: 3 }, [issue]), [{ kind: "recover", number: 7, postComment: false }]);
    const forged = owned(8, [apexProblem], [userComment(recoveredComment(NOW))]);
    assert.deepEqual(planIssues({ state: "clean", passes: 3 }, [forged]), [{ kind: "recover", number: 8, postComment: true }]);
  });
});

describe("keyOf", () => {
  test("lists failing checks in a fixed order", () => {
    assert.equal(keyOf([deployProblem, apexProblem]), "apex,deployment");
    assert.deepEqual([...CHECK_IDS], ["apex", "www", "http", "http-www", "deployment"]);
  });
});

describe("issueBody", () => {
  test("links the README emergency path by URL and explains the rollback case", () => {
    const body = issueBody([apexProblem], NOW, REPO);
    assert.ok(body.includes(`(${emergencyUrl(REPO)})`));
    assert.equal(emergencyUrl(REPO), "https://github.com/owner/site/blob/main/README.md#emergency-path");
    assert.match(body, /instant rollback .* deployment problem stays until a new deploy succeeds/);
  });
});

// ---------------------------------------------------------------- matrix

describe("I/O matrix (spec): issue action per scenario", () => {
  const run = async (sites: Site[], issues: FakeIssue[] = [], labels?: string[]) => {
    const t = deps(sites, issues, labels);
    assert.equal(await main([], t.d), 0);
    return { ...t, written: writes(t.calls) };
  };
  const assertCreated = (written: GhCall[], pattern: RegExp) => {
    assert.equal(written.length, 1);
    assert.deepEqual(written[0].args.slice(0, 2), ["issue", "create"]);
    assert.match(written[0].input ?? "", pattern);
  };

  test("Healthy: no issue activity", async () => {
    const { written, sleeps } = await run([{}]);
    assert.deepEqual(written, []);
    assert.deepEqual(sleeps, []);
  });
  test("Site down (5xx, 404 or timeout on all three passes): issue opened naming it", async () => {
    for (const apex of [
      { status: 500, location: null, body: "" },
      { status: 404, location: null, body: "" },
      new Error("The operation was aborted due to timeout"),
    ]) {
      const { written } = await run([{ apex }]);
      assertCreated(written, /\*\*apex\*\*: https:\/\/shahrouzmohaghegh\.com\/ (answered HTTP|did not answer)/);
    }
  });
  test("Blip: apex fails once, then passes: nothing", async () => {
    assert.deepEqual((await run([APEX_DOWN, {}])).written, []);
  });
  test("Wrong page: 200 without the name is named", async () => {
    assertCreated((await run([{ apex: ok("Deployment not found") }])).written, /does not contain "Shahrouz Mohaghegh"/);
  });
  test("Redirect broken: www answers 200 or 307, named", async () => {
    for (const www of [ok(NAME), redirect(307, APEX)]) {
      assertCreated((await run([{ www }])).written, new RegExp(`\\*\\*www\\*\\*: .*HTTP ${www.status}`));
    }
  });
  test("Deploy failed: latest Production status failure, named", async () => {
    assertCreated((await run([{ statuses: deployState("failure") }])).written, /\*\*deployment\*\*: .* is "failure"/);
  });
  test("Still down, same problems: no new comment", async () => {
    assert.deepEqual((await run([APEX_DOWN], [botIssue(7, [apexProblem])])).written, []);
  });
  test("Still down, problems changed: one comment", async () => {
    const { written } = await run([{ ...APEX_DOWN, statuses: deployState("error") }], [botIssue(7, [apexProblem])]);
    assert.equal(written.length, 1);
    assert.deepEqual(written[0].args, ["issue", "comment", "7", "--repo", REPO, "--body-file", "-"]);
    assert.match(written[0].input ?? "", /problems: apex,deployment/);
  });
  test("Recovered: three clean passes, then comment and close", async () => {
    const { written, sleeps } = await run([{}], [botIssue(7, [apexProblem])]);
    assert.equal(sleeps.length, PASSES - 1);
    assert.deepEqual(written.map((w) => w.args.slice(0, 2).join(" ")), ["issue comment", "issue close"]);
    assert.match(written[0].input ?? "", /^Recovered at 2026-10-09T12:00:00\.000Z/);
  });
  test("GitHub API down: named as a problem, not a crash", async () => {
    const { written } = await run([{ deployments: new Error("fetch failed") }]);
    assertCreated(written, /\*\*deployment\*\*: could not read Production deployments: fetch failed/);
  });
});

describe("applying the plan", () => {
  const run = async (sites: Site[], issues: FakeIssue[] = [], labels?: string[]) => {
    const t = deps(sites, issues, labels);
    assert.equal(await main([], t.d), 0);
    return writes(t.calls);
  };
  test("create assigns the owner and labels it, creating the label only when missing", async () => {
    const existing = await run([APEX_DOWN]);
    assert.deepEqual(existing[0].args, [
      "issue", "create", "--repo", REPO, "--title", ISSUE_TITLE, "--body-file", "-", "--label", LABEL, "--assignee", "owner",
    ]);
    const missing = await run([APEX_DOWN], [], ["bug"]);
    assert.deepEqual(missing.map((w) => w.args.slice(0, 3).join(" ")), ["label create production", "issue create --repo"]);
  });
  test("a forged open issue does not absorb the alert, and is never closed", async () => {
    const forged: FakeIssue = { ...botIssue(5, [apexProblem]), author: { login: "mallory", is_bot: false } };
    assert.deepEqual((await run([APEX_DOWN], [forged]))[0].args.slice(0, 2), ["issue", "create"]);
    assert.deepEqual(await run([{}], [forged]), []);
  });
  test("recovery closes every bot issue; duplicates close as not planned", async () => {
    const recovered = await run([{}], [botIssue(4, [apexProblem]), botIssue(9, [apexProblem])]);
    assert.deepEqual(
      recovered.filter((w) => w.args[1] === "close").map((w) => w.args[2]),
      ["9", "4"],
    );
    const dup = await run([APEX_DOWN], [botIssue(4, [apexProblem]), botIssue(9, [apexProblem])]);
    assert.deepEqual(dup[0].args.slice(0, 3), ["issue", "close", "4"]);
    assert.ok(dup[0].args.includes("not planned"));
    assert.match(dup[0].args.at(-1) ?? "", /^Duplicate of #9/);
  });
});

// ---------------------------------------------------------------- CLI

describe("main", () => {
  test("--print reports every check and touches no issue", async () => {
    const { d, calls, out } = deps([{}]);
    assert.equal(await main(["--print"], d), 0);
    assert.deepEqual(calls, []);
    assert.equal(out.join("").match(/^pass /gm)?.length, CHECK_IDS.length);
    assert.match(out.join(""), /Every check passes\./);
  });
  test("--print with a problem exits 1 and still touches no issue", async () => {
    const { d, calls, out } = deps([APEX_DOWN]);
    assert.equal(await main(["--print"], d), 1);
    assert.deepEqual(calls, []);
    assert.match(out.join(""), /^FAIL  https:\/\/shahrouzmohaghegh\.com\//m);
  });
  test("outside GitHub Actions it behaves as --print", async () => {
    const { d, calls, err } = deps([APEX_DOWN]);
    d.env = {};
    assert.equal(await main([], d), 1);
    assert.deepEqual(calls, []);
    assert.match(err.join("\n"), /not running in GitHub Actions/);
  });
  test("--simulate-failure in Actions opens a real issue without retries", async () => {
    const { d, calls, sleeps } = deps([{}]);
    assert.equal(await main(["--simulate-failure"], d), 0);
    assert.deepEqual(sleeps, []);
    const [create] = writes(calls);
    assert.deepEqual(create.args.slice(0, 2), ["issue", "create"]);
    assert.match(create.input ?? "", /simulated failure/);
  });
  test("an unknown argument exits 1 before any request", async () => {
    const { d, calls, err } = deps([{ apex: new Error("must not be fetched") }]);
    assert.equal(await main(["--dry-run"], d), 1);
    assert.deepEqual(calls, []);
    assert.match(err.join(""), /unknown argument/);
  });
  test("a gh failure rejects", async () => {
    const { d } = deps([APEX_DOWN]);
    d.gh = () => {
      throw new Error("gh issue list failed");
    };
    await assert.rejects(main([], d), /gh issue list failed/);
  });
});

describe("makeGh", () => {
  const spawnReturning = (result: ReturnType<Spawn>): { spawn: Spawn; seen: Parameters<Spawn>[] } => {
    const seen: Parameters<Spawn>[] = [];
    return { seen, spawn: (...args) => (seen.push(args), result) };
  };
  test("returns stdout and passes the input on stdin", () => {
    const { spawn, seen } = spawnReturning({ status: 0, stdout: "[]", stderr: "" });
    assert.equal(makeGh(spawn)(["issue", "list"], "body"), "[]");
    assert.equal(seen[0][0], "gh");
    assert.equal(seen[0][2].input, "body");
  });
  test("a non-zero exit throws naming the subcommand and stderr", () => {
    const { spawn } = spawnReturning({ status: 1, stdout: "", stderr: "HTTP 403\n" });
    assert.throws(() => makeGh(spawn)(["issue", "create", "--repo", REPO]), /^Error: gh issue create failed: HTTP 403$/);
  });
  test("a spawn error throws naming the subcommand and the cause", () => {
    const { spawn } = spawnReturning({ status: null, stdout: "", stderr: "", error: new Error("spawn gh ENOENT") });
    assert.throws(() => makeGh(spawn)(["label", "list"]), /gh label list failed: spawn gh ENOENT/);
  });
});

describe("report", () => {
  test("names each failing check with its detail", () => {
    const text = report(problemsVerdict([{ check: "deployment", detail: 'is "error"' }]));
    assert.match(text, /^pass  https:\/\/shahrouzmohaghegh\.com\//m);
    assert.match(text, /^FAIL  the latest Production deployment/m);
    assert.match(text, /1 check\(s\) failed on all 3 passes/);
  });
  test("an inconclusive run says nothing counts", () => {
    assert.match(report({ state: "inconclusive", last: [apexProblem] }), /nothing counts this run/);
  });
});

describe("defaultHttp", () => {
  const capture = () => {
    const seen: { url: string; init: RequestInit }[] = [];
    const fetchImpl = async (url: string, init: RequestInit): Promise<Response> => {
      seen.push({ url, init });
      return new Response("body", { status: 308, headers: { location: APEX } });
    };
    return { seen, fetchImpl };
  };
  test("does not follow redirects and returns status and Location", async () => {
    const { seen, fetchImpl } = capture();
    assert.deepEqual(await defaultHttp(WWW, { fetchImpl, token: "t" }), { status: 308, location: APEX, body: "body" });
    assert.equal(seen[0].init.redirect, "manual");
    assert.ok(seen[0].init.signal instanceof AbortSignal);
    assert.equal(TIMEOUT_MS, 20_000);
  });
  test("sends the token to api.github.com only", async () => {
    const { seen, fetchImpl } = capture();
    await defaultHttp(APEX, { fetchImpl, token: "secret" });
    await defaultHttp(deploymentsUrl(REPO), { fetchImpl, token: "secret" });
    const auth = (i: number) => (seen[i].init.headers as Record<string, string>).Authorization;
    assert.equal(auth(0), undefined);
    assert.equal(auth(1), "Bearer secret");
  });
  test("a non-OK status resolves rather than throwing", async () => {
    const fetchImpl = async (): Promise<Response> => new Response("", { status: 503 });
    assert.equal((await defaultHttp(APEX, { fetchImpl, token: "" })).status, 503);
  });
});
