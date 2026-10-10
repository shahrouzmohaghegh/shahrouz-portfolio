// Tests for pin-review.mts. Run with: npm run test:scripts
//
// Every network input is a fixture: fetches and gh calls are fakes, so no
// test touches the network or GitHub. One suite reads the real
// dependabot.yml and ci.yml to prove every pin there is covered.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, test } from "node:test";
import { fileURLToPath } from "node:url";

import {
  CITED_REPOS,
  citedRepoApi,
  CI_YML,
  DEPENDABOT_YML,
  DOMAIN_RDAP,
  HANDLED_RULES,
  ISSUE_TITLE,
  admitsMajor,
  buildReport,
  collectFacts,
  alertLine,
  decideIssue,
  domainFacts,
  main,
  majorOf,
  markerOf,
  maxSatisfying,
  parseChecksum,
  parseGitleaksPin,
  parseExpiry,
  parseIgnoreRules,
  parseRepoVisibility,
  syncIssue,
  type Deps,
  type FetchText,
  type Issue,
  type LocalFiles,
} from "./pin-review.mts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SHA_PINNED = "a".repeat(64);
const SHA_NEW = "b".repeat(64);

const DEPENDABOT = `version: 2
updates:
  - package-ecosystem: npm
    directory: /
    ignore:
      # TypeScript 7 crashes next build; the stack pins ^5.
      - dependency-name: typescript
        versions: [">= 6"]
      # Types must match the Node runtime,
      # which is pinned to 24.
      - dependency-name: "@types/node"
        versions:
          - ">= 25"
      # eslint-plugin-import supports ESLint 9 at most.
      - dependency-name: 'eslint'
        versions: [">= 10", "< 2"]
  - package-ecosystem: github-actions
    directory: /
    ignore:
      # Not an npm rule, so not reported.
      - dependency-name: actions/checkout
        versions: [">= 99"]
`;

const LOCAL: LocalFiles = {
  packageJson: JSON.stringify({ devDependencies: { eslint: "^9", typescript: "^5", "@types/node": "^24" } }),
  nvmrc: "24\n",
  dependabotYml: DEPENDABOT,
  ciYml: [
    "      - name: Secret scan",
    "        env:",
    "          GITLEAKS_VERSION: 8.30.1",
    `          GITLEAKS_SHA256: ${SHA_PINNED}`,
  ].join("\n"),
  repo: "o/r",
};

const BRANCH_URL = "https://api.github.com/repos/o/r/branches/main";
const PROTECTED = JSON.stringify({
  protected: true,
  protection: {
    enabled: true,
    required_status_checks: { enforcement_level: "everyone", contexts: ["gate"], checks: [{ context: "gate" }] },
  },
});

const NOW = new Date("2026-10-09T12:00:00Z");
const EXPIRY = "2027-10-08T11:37:10Z";
const rdap = (expiration: string): string =>
  JSON.stringify({
    events: [
      { eventAction: "registration", eventDate: "2026-10-08T11:37:10Z" },
      { eventAction: "expiration", eventDate: expiration },
    ],
  });

const CAS_API = "https://api.github.com/repos/shahrouzmohaghegh/career-application-system";
const SITE_API = "https://api.github.com/repos/shahrouzmohaghegh/shahrouz-portfolio";

const PINNED_CHECKSUMS = "https://github.com/gitleaks/gitleaks/releases/download/v8.30.1/gitleaks_8.30.1_checksums.txt";

function responses(over: Record<string, string | undefined> = {}): Record<string, string> {
  const base: Record<string, string | undefined> = {
    "https://registry.npmjs.org/eslint-config-next/latest": JSON.stringify({
      version: "16.4.0",
      dependencies: { "eslint-plugin-import": "^2.31.0" },
      peerDependencies: { eslint: ">=9.0.0" },
    }),
    "https://registry.npmjs.org/eslint-plugin-import": JSON.stringify({
      versions: {
        "2.31.0": { version: "2.31.0", peerDependencies: { eslint: "^8 || ^9" } },
        "2.32.0": { version: "2.32.0", peerDependencies: { eslint: "^2 || ^3 || ^7.2.0 || ^8 || ^9" } },
        "3.0.0-beta.1": { version: "3.0.0-beta.1", peerDependencies: { eslint: "^10" } },
      },
    }),
    "https://registry.npmjs.org/typescript/latest": JSON.stringify({ version: "7.0.2" }),
    "https://registry.npmjs.org/@types%2fnode/latest": JSON.stringify({ version: "26.6.4" }),
    [PINNED_CHECKSUMS]: `${SHA_PINNED}  gitleaks_8.30.1_linux_x64.tar.gz\n`,
    "https://api.github.com/repos/gitleaks/gitleaks/releases/latest": JSON.stringify({
      tag_name: "v8.31.0",
      assets: [
        { name: "gitleaks_8.31.0_linux_x64.tar.gz", browser_download_url: "https://example.test/archive" },
        { name: "gitleaks_8.31.0_checksums.txt", browser_download_url: "https://example.test/checksums" },
      ],
    }),
    "https://example.test/checksums": [
      `${"c".repeat(64)}  gitleaks_8.31.0_darwin_arm64.tar.gz`,
      `${SHA_NEW}  gitleaks_8.31.0_linux_x64.tar.gz`,
    ].join("\n"),
    [DOMAIN_RDAP]: rdap(EXPIRY),
    [BRANCH_URL]: PROTECTED,
    [CAS_API]: JSON.stringify({ full_name: "shahrouzmohaghegh/career-application-system", private: false }),
    [SITE_API]: JSON.stringify({ full_name: "shahrouzmohaghegh/shahrouz-portfolio", private: false }),
    ...over,
  };
  return Object.fromEntries(Object.entries(base).filter((entry): entry is [string, string] => entry[1] !== undefined));
}

// A URL missing from the table answers 503; one mapped to NOT_FOUND answers 404.
const NOT_FOUND = "\u0000404";
const fakeFetch =
  (table: Record<string, string> = responses()): FetchText =>
  async (url) => {
    if (!(url in table)) throw new Error(`${url}: HTTP 503`);
    if (table[url] === NOT_FOUND) throw new Error(`${url}: HTTP 404`);
    return table[url];
  };

const reportFor = async (table = responses(), local = LOCAL, now = NOW): Promise<string> =>
  buildReport(await collectFacts(fakeFetch(table), local, now));

describe("pin-review parsers", () => {
  test("parseIgnoreRules reads only the npm entry, with flow, block and quoted forms", () => {
    assert.deepEqual(parseIgnoreRules(DEPENDABOT), [
      { name: "typescript", versions: [">= 6"], reason: "TypeScript 7 crashes next build; the stack pins ^5." },
      { name: "@types/node", versions: [">= 25"], reason: "Types must match the Node runtime, which is pinned to 24." },
      { name: "eslint", versions: [">= 10", "< 2"], reason: "eslint-plugin-import supports ESLint 9 at most." },
    ]);
  });

  test("parseIgnoreRules fails without an npm entry", () => {
    assert.throws(() => parseIgnoreRules("version: 2\nupdates:\n  - package-ecosystem: pip\n"), /no npm entry/);
  });

  test("parseGitleaksPin reads version and checksum from ci.yml, and fails when absent", () => {
    assert.deepEqual(parseGitleaksPin(LOCAL.ciYml), { version: "8.30.1", sha256: SHA_PINNED });
    assert.throws(() => parseGitleaksPin("jobs: {}\n"));
  });

  test("parseChecksum picks the linux x64 archive only", () => {
    assert.equal(parseChecksum(responses()["https://example.test/checksums"], "8.31.0"), SHA_NEW);
    assert.throws(() => parseChecksum(responses()["https://example.test/checksums"], "8.30.1"));
  });

  test("parseExpiry reads the expiration event, and fails without a valid one", () => {
    assert.equal(parseExpiry(rdap(EXPIRY)), EXPIRY);
    assert.throws(() => parseExpiry(JSON.stringify({ events: [{ eventAction: "registration", eventDate: EXPIRY }] })), /no valid expiration/);
    assert.throws(() => parseExpiry(rdap("soon")), /no valid expiration/);
    assert.throws(() => parseExpiry("<html>"));
  });

  test("domainFacts counts whole days: ok beyond 21, near at 21 or fewer, expired once past", () => {
    assert.deepEqual(domainFacts(EXPIRY, NOW), { state: "ok", expires: "2027-10-08", daysRemaining: 363 });
    assert.deepEqual(domainFacts("2026-10-30T12:00:00Z", NOW), { state: "near", expires: "2026-10-30", daysRemaining: 21 });
    assert.equal(domainFacts("2026-10-31T12:00:00Z", NOW).state, "ok");
    assert.equal(domainFacts("2026-10-09T13:00:00Z", NOW).state, "near");
    assert.equal(domainFacts("2026-10-09T12:00:00Z", NOW).state, "expired");
    assert.deepEqual(domainFacts("2026-10-01T12:00:00Z", NOW), { state: "expired", expires: "2026-10-01", daysRemaining: -8 });
  });

  test("parseRepoVisibility reads the private flag, and fails on any other shape", () => {
    assert.equal(parseRepoVisibility(JSON.stringify({ private: false })), "public");
    assert.equal(parseRepoVisibility(JSON.stringify({ private: true })), "private");
    assert.throws(() => parseRepoVisibility(JSON.stringify({ private: "no" })), /private is not a boolean/);
    assert.throws(() => parseRepoVisibility("null"), /private is not a boolean/);
    assert.throws(() => parseRepoVisibility("<html>"));
  });

  test("majorOf reads the first number", () => {
    assert.equal(majorOf("^5"), 5);
    assert.equal(majorOf("26.6.4"), 26);
    assert.throws(() => majorOf("latest"));
  });
});

describe("the real configuration", () => {
  const read = (path: string): string => readFileSync(join(ROOT, path), "utf8");

  test("every npm ignore rule has versions, a reason and a handler", () => {
    const rules = parseIgnoreRules(read(DEPENDABOT_YML));
    assert.ok(rules.length > 0);
    for (const rule of rules) {
      assert.ok(rule.versions.length > 0 && rule.versions.every(Boolean), `${rule.name}: no versions`);
      assert.ok(rule.reason.trim() !== "", `${rule.name}: no reason`);
      assert.ok(HANDLED_RULES.includes(rule.name), `${rule.name}: no handler`);
    }
  });

  test("the gitleaks pin in ci.yml parses", () => {
    const pin = parseGitleaksPin(read(CI_YML));
    assert.match(pin.version, /^\d+\.\d+\.\d+$/);
  });
});

describe("semver ranges", () => {
  const cases: [string, number, boolean | null][] = [
    ["^2 || ^3 || ^4 || ^5 || ^6 || ^7.2.0 || ^8 || ^9", 10, false],
    ["^2 || ^3 || ^4 || ^5 || ^6 || ^7.2.0 || ^8 || ^9", 9, true],
    ["^8 || ^9 || ^10", 10, true],
    [">=8", 10, true],
    [">=8 <10", 10, false],
    [">= 8 < 10.1", 10, true],
    ["<=9", 10, false],
    ["<=10", 10, true],
    [">9.9.9", 10, true],
    ["8 - 9", 10, false],
    ["8 - 10", 10, true],
    ["~9.4", 10, false],
    ["10.x", 10, true],
    ["*", 10, true],
    ["", 10, true],
    ["^0.0.3", 0, true],
    ["^0.2", 1, false],
    ["latest", 10, null],
  ];
  for (const [range, major, expected] of cases) {
    test(`"${range}" admits ${major}: ${expected}`, () => assert.equal(admitsMajor(range, major), expected));
  }

  test("maxSatisfying picks the highest release in range and skips prereleases", () => {
    const versions = ["2.30.0", "2.32.0", "2.31.5", "3.0.0", "2.33.0-rc.1"];
    assert.equal(maxSatisfying(versions, "^2.31.0"), "2.32.0");
    assert.equal(maxSatisfying(versions, "^4"), null);
    assert.equal(maxSatisfying(versions, "latest"), null);
  });
});

describe("collectFacts and buildReport", () => {
  test("the report lists every pin, the gitleaks facts and the quoted reasons", async () => {
    const report = await reportFor();
    assert.match(report, /## typescript \(pinned `\^5`\)/);
    assert.match(report, /Reason, from `\.github\/dependabot\.yml`: TypeScript 7 crashes next build/);
    assert.match(report, /latest: 7\.0\.2 \(major 7\)/);
    assert.match(report, /Node major in `\.nvmrc`: 24/);
    assert.match(report, /pinned major matches `\.nvmrc`: yes/);
    assert.match(report, /npm latest, for reference: 26\.6\.4/);
    assert.match(report, /eslint-config-next latest: 16\.4\.0/);
    assert.match(report, /its own `eslint` peer range: `>=9\.0\.0`; admits ESLint 10: yes/);
    assert.match(report, /highest eslint-plugin-import in that range: 2\.32\.0, .*admits ESLint 10: no/);
    assert.match(report, /Dependabot ignores `>= 10`, `< 2`\./);
    assert.match(report, /- pinned: 8\.30\.1, SHA-256 `a{64}`/);
    assert.match(report, /pinned SHA-256 matches the published checksum for 8\.30\.1: yes/);
    assert.match(report, /- latest release: 8\.31\.0/);
    assert.match(report, /linux x64 SHA-256 of 8\.31\.0, from `gitleaks_8\.31\.0_checksums\.txt`: `b{64}`/);
    assert.match(report, /## branch protection \(main\)[\s\S]*- state: intact, in o\/r/);
    assert.match(report, /not visible without an admin token and are not checked/);
    assert.match(report, /## domain \(shahrouzmohaghegh\.com\)/);
    assert.match(report, /- state: ok\n- expires: 2027-10-08\n- days remaining: 363/);
    assert.match(report, /within 21 days of expiry, late enough not to fire before the registrar's own auto-renew/);
    assert.match(
      report,
      /## cited repository \(shahrouzmohaghegh\/career-application-system\)\n\nThe site cites https:\/\/github\.com\/shahrouzmohaghegh\/career-application-system [^\n]*\n\n- state: public\n\n## cited repository \(shahrouzmohaghegh\/shahrouz-portfolio\)\n\nThe site cites https:\/\/github\.com\/shahrouzmohaghegh\/shahrouz-portfolio [^\n]*\n\n- state: public\n$/,
    );
    assert.doesNotMatch(report, /Needs attention/);
  });

  test("a cited repository that is private, missing or unreadable is reported, alerted and in the key", async () => {
    const lead = (report: string): string => report.split("\n")[3];
    const before = markerOf(await reportFor());
    const isPrivate = await reportFor(responses({ [CAS_API]: JSON.stringify({ private: true }) }));
    const missing = await reportFor(responses({ [CAS_API]: NOT_FOUND }));
    const down = await reportFor(responses({ [CAS_API]: undefined }));
    const malformed = await reportFor(responses({ [CAS_API]: "{}" }));
    assert.match(isPrivate, /career-application-system[^#]*- state: private\n/);
    assert.match(missing, /career-application-system[^#]*- state: missing\n/);
    assert.match(down, /- state: unreadable \(https:\/\/api\.github\.com\/repos\/shahrouzmohaghegh\/career-application-system: HTTP 503\)\n/);
    assert.match(malformed, /- state: unreadable \(unexpected repository response: private is not a boolean\)/);
    assert.equal(lead(isPrivate), "**Needs attention:** shahrouzmohaghegh/career-application-system is private. Details below.");
    assert.equal(lead(missing), "**Needs attention:** shahrouzmohaghegh/career-application-system was not found. Details below.");
    assert.equal(lead(down), "**Needs attention:** shahrouzmohaghegh/career-application-system could not be read. Details below.");
    const keys = [before, markerOf(isPrivate), markerOf(missing), markerOf(down)];
    assert.equal(new Set(keys).size, 4);
    assert.equal(markerOf(malformed), markerOf(down));
    assert.match(down, /## gitleaks/);
  });

  test("both claimed public repositories are watched, each with its own state and alert", async () => {
    assert.deepEqual([...CITED_REPOS], ["shahrouzmohaghegh/career-application-system", "shahrouzmohaghegh/shahrouz-portfolio"]);
    assert.equal(citedRepoApi(CITED_REPOS[1]), SITE_API);
    const lead = (report: string): string => report.split("\n")[3];
    const before = markerOf(await reportFor());
    const sitePrivate = await reportFor(responses({ [SITE_API]: JSON.stringify({ private: true }) }));
    const casPrivate = await reportFor(responses({ [CAS_API]: JSON.stringify({ private: true }) }));
    assert.match(sitePrivate, /## cited repository \(shahrouzmohaghegh\/shahrouz-portfolio\)[^#]*- state: private\n$/);
    assert.equal(lead(sitePrivate), "**Needs attention:** shahrouzmohaghegh/shahrouz-portfolio is private. Details below.");
    assert.equal(new Set([before, markerOf(sitePrivate), markerOf(casPrivate)]).size, 3);
    const both = await reportFor(responses({ [CAS_API]: NOT_FOUND, [SITE_API]: undefined }));
    assert.equal(
      lead(both),
      "**Needs attention:** shahrouzmohaghegh/career-application-system was not found; shahrouzmohaghegh/shahrouz-portfolio could not be read. Details below.",
    );
  });

  test("the domain moves the key only when its state changes, not daily", async () => {
    const before = markerOf(await reportFor());
    const nextMonth = await reportFor(responses(), LOCAL, new Date("2026-11-09T12:00:00Z"));
    const near = await reportFor(responses(), LOCAL, new Date("2027-09-20T12:00:00Z"));
    const expired = await reportFor(responses(), LOCAL, new Date("2027-10-13T12:00:00Z"));
    assert.equal(markerOf(nextMonth), before);
    assert.match(nextMonth, /days remaining: 332/);
    assert.notEqual(markerOf(near), before);
    assert.match(near, /- state: near\n- expires: 2027-10-08\n- days remaining: 17/);
    assert.notEqual(markerOf(expired), markerOf(near));
    assert.match(expired, /- state: expired\n- expires: 2027-10-08\n- expired 5 days ago/);
  });

  test("an RDAP failure, such as a lapsed domain's 404, is reported as unreadable and the report still builds", async () => {
    const report = await reportFor(responses({ [DOMAIN_RDAP]: undefined }));
    assert.match(report, /- state: unreadable \(https:\/\/rdap\.verisign\.com.*HTTP 503\)/);
    assert.match(report, /## gitleaks/);
    assert.notEqual(markerOf(report), markerOf(await reportFor()));
    const noEvent = await reportFor(responses({ [DOMAIN_RDAP]: JSON.stringify({ events: [] }) }));
    assert.match(noEvent, /- state: unreadable \(RDAP for shahrouzmohaghegh\.com has no valid expiration event\)/);
  });

  test("drifted protection is listed, in the key, and the error text of an unreadable one is not", async () => {
    const intact = markerOf(await reportFor());
    const drifted = await reportFor(responses({ [BRANCH_URL]: JSON.stringify({ protected: false }) }));
    assert.match(drifted, /- state: drifted, in o\/r\n {2}- main is not protected/);
    assert.notEqual(markerOf(drifted), intact);
    const down = await reportFor(responses({ [BRANCH_URL]: undefined }));
    const otherwiseDown = await reportFor(responses({ [BRANCH_URL]: "null" }));
    assert.match(down, /- state: unreadable \(.*HTTP 503\)/);
    assert.match(otherwiseDown, /- state: unreadable \(unexpected branch response: not an object\)/);
    assert.equal(markerOf(down), markerOf(otherwiseDown));
    assert.notEqual(markerOf(down), intact);
  });

  test("an unknown repository reads protection as unreadable without fetching it", async () => {
    const report = await reportFor(responses({ [BRANCH_URL]: undefined }), { ...LOCAL, repo: null });
    assert.match(report, /- state: unreadable \(repository unknown/);
  });

  test("an alert line leads the body when protection or the domain needs action", async () => {
    const lead = (report: string): string => report.split("\n")[3];
    const drifted = await reportFor(responses({ [BRANCH_URL]: JSON.stringify({ protected: false }) }));
    assert.equal(lead(drifted), "**Needs attention:** main protection has drifted. Details below.");
    const near = await reportFor(responses(), LOCAL, new Date("2027-09-20T12:00:00Z"));
    assert.equal(lead(near), "**Needs attention:** shahrouzmohaghegh.com expires in 17 days. Details below.");
    const both = await reportFor(responses({ [BRANCH_URL]: undefined, [DOMAIN_RDAP]: undefined }));
    assert.equal(
      lead(both),
      "**Needs attention:** main protection could not be read; shahrouzmohaghegh.com expiry could not be read. Details below.",
    );
    const expired = await collectFacts(fakeFetch(), LOCAL, new Date("2027-10-13T12:00:00Z"));
    assert.match(alertLine(expired) ?? "", /shahrouzmohaghegh\.com expired 5 days ago/);
    assert.equal(alertLine(await collectFacts(fakeFetch(), LOCAL, NOW)), null);
    assert.ok(lead(await reportFor()).startsWith("Facts from"));
  });

  test("the marker key holds decision facts only, so a patch release keeps it", async () => {
    const before = markerOf(await reportFor());
    const patched = await reportFor(
      responses({
        "https://registry.npmjs.org/typescript/latest": JSON.stringify({ version: "7.0.3" }),
        "https://registry.npmjs.org/@types%2fnode/latest": JSON.stringify({ version: "26.7.0" }),
      }),
    );
    assert.ok(before);
    assert.equal(markerOf(patched), before);
    assert.match(patched, /latest: 7\.0\.3/);
  });

  test("the marker key changes when a major moves or the pinned checksum stops matching", async () => {
    const before = markerOf(await reportFor());
    const major = await reportFor(responses({ "https://registry.npmjs.org/typescript/latest": JSON.stringify({ version: "8.0.0" }) }));
    const checksum = await reportFor(responses({ [PINNED_CHECKSUMS]: `${SHA_NEW}  gitleaks_8.30.1_linux_x64.tar.gz\n` }));
    assert.notEqual(markerOf(major), before);
    assert.notEqual(markerOf(checksum), before);
    assert.match(checksum, /pinned SHA-256 matches the published checksum for 8\.30\.1: no/);
  });

  test("an ignore rule with no handler fails with a clear message", async () => {
    const local = { ...LOCAL, dependabotYml: DEPENDABOT.replace("dependency-name: typescript", "dependency-name: left-pad") };
    await assert.rejects(collectFacts(fakeFetch(), local), /no pin-review handler for ignore rule\(s\): left-pad/);
  });

  test("a missing devDependency fails", async () => {
    const local = { ...LOCAL, packageJson: JSON.stringify({ devDependencies: { eslint: "^9", typescript: "^5" } }) };
    await assert.rejects(collectFacts(fakeFetch(), local), /no devDependency @types\/node/);
  });

  test("a gitleaks release without a checksums file fails", async () => {
    const table = responses({
      "https://api.github.com/repos/gitleaks/gitleaks/releases/latest": JSON.stringify({ tag_name: "v8.31.0", assets: [] }),
    });
    await assert.rejects(collectFacts(fakeFetch(table), LOCAL), /publishes no checksums\.txt/);
  });

  test("a failed fetch rejects, so no report is built", async () => {
    const table = responses({ "https://registry.npmjs.org/typescript/latest": undefined });
    await assert.rejects(collectFacts(fakeFetch(table), LOCAL), /HTTP 503/);
  });
});

const KEY_A = '<!-- pin-review key: {"a":1} -->\nbody';
const KEY_B = '<!-- pin-review key: {"a":2} -->\nbody';

const issue = (number: number, state: string, body: string, closedAt: string | null = null): Issue => ({
  number,
  title: ISSUE_TITLE,
  body,
  state,
  closedAt,
});

describe("decideIssue", () => {
  test("an open issue with the same key is left alone, even if display text differs", () => {
    assert.equal(decideIssue(KEY_A, [issue(3, "OPEN", `${KEY_A}\nolder versions`)]).action, "none");
  });

  test("an open issue with a different key is updated", () => {
    assert.deepEqual(decideIssue(KEY_B, [issue(3, "OPEN", KEY_A)]), { action: "update", number: 3 });
  });

  test("of several open issues carrying the marker, the newest is updated", () => {
    assert.deepEqual(decideIssue(KEY_B, [issue(3, "OPEN", KEY_A), issue(7, "OPEN", KEY_A)]), { action: "update", number: 7 });
  });

  test("with none open, an unchanged key since the last close creates nothing", () => {
    const issues = [issue(1, "CLOSED", KEY_B, "2026-08-01T00:00:00Z"), issue(2, "CLOSED", KEY_A, "2026-09-01T00:00:00Z")];
    assert.equal(decideIssue(KEY_A, issues).action, "none");
  });

  test("with none open, a key that moved since the last close creates a new issue", () => {
    const issues = [issue(1, "CLOSED", KEY_A, "2026-08-01T00:00:00Z"), issue(2, "CLOSED", KEY_B, "2026-09-01T00:00:00Z")];
    assert.deepEqual(decideIssue(KEY_A, issues), { action: "create" });
  });

  test("issues are found by marker: a renamed one counts, an unmarked one with the title does not", () => {
    const renamed: Issue = { ...issue(4, "OPEN", KEY_A), title: "Renamed" };
    assert.equal(decideIssue(KEY_A, [renamed]).action, "none");
    assert.deepEqual(decideIssue(KEY_A, [issue(5, "OPEN", "no marker")]), { action: "create" });
  });
});

type Call = { args: string[]; input?: string };

function fakeGh(issues: Issue[]) {
  const calls: Call[] = [];
  const gh = (args: string[], input?: string): string => {
    calls.push({ args, input });
    return args[1] === "list" ? JSON.stringify(issues) : "";
  };
  return { gh, calls };
}

describe("syncIssue", () => {
  test("creates through stdin when nothing exists", () => {
    const { gh, calls } = fakeGh([]);
    syncIssue(KEY_A, gh);
    assert.deepEqual(calls[1], { args: ["issue", "create", "--title", ISSUE_TITLE, "--body-file", "-"], input: KEY_A });
  });

  test("updates the open issue through stdin when the key changed", () => {
    const { gh, calls } = fakeGh([issue(4, "OPEN", KEY_A)]);
    syncIssue(KEY_B, gh);
    assert.deepEqual(calls[1], { args: ["issue", "edit", "4", "--body-file", "-"], input: KEY_B });
  });

  test("makes no write when nothing changed", () => {
    const { gh, calls } = fakeGh([issue(4, "OPEN", KEY_A)]);
    syncIssue(KEY_A, gh);
    assert.equal(calls.length, 1);
  });
});

describe("main", () => {
  function deps(issues: Issue[] = []) {
    const { gh, calls } = fakeGh(issues);
    const out: string[] = [];
    const err: string[] = [];
    const d: Deps = {
      fetchText: fakeFetch(),
      gh,
      readLocal: () => LOCAL,
      out: (text) => out.push(text),
      err: (text) => err.push(text),
    };
    return { d, calls, out, err };
  }

  test("--print prints the report and makes no gh call", async () => {
    const { d, calls, out } = deps();
    assert.equal(await main(["--print"], d), 0);
    assert.equal(calls.length, 0);
    assert.match(out.join(""), /## gitleaks/);
  });

  test("with no flags it syncs the issue", async () => {
    const { d, calls } = deps();
    assert.equal(await main([], d), 0);
    assert.deepEqual(
      calls.map((c) => c.args[1]),
      ["list", "create"],
    );
  });

  test("an unknown flag exits 1 before fetching or calling gh", async () => {
    const { d, calls, err } = deps();
    d.fetchText = async () => assert.fail("fetched");
    assert.equal(await main(["--dry-run"], d), 1);
    assert.equal(calls.length, 0);
    assert.match(err.join(""), /unknown argument/);
  });

  test("a failed RDAP fetch still writes the issue, with the domain unreadable", async () => {
    const { d, calls, out } = deps();
    d.fetchText = fakeFetch(responses({ [DOMAIN_RDAP]: undefined }));
    assert.equal(await main([], d), 0);
    assert.match(out.join(""), /expiry could not be read/);
    assert.deepEqual(
      calls.map((c) => c.args[1]),
      ["list", "create"],
    );
  });

  test("a failed fetch rejects before any gh call", async () => {
    const { d, calls } = deps();
    d.fetchText = fakeFetch(responses({ "https://registry.npmjs.org/eslint-config-next/latest": undefined }));
    await assert.rejects(main([], d), /HTTP 503/);
    assert.equal(calls.length, 0);
  });
});
