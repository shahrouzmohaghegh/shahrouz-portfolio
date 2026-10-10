// Reports on every version this project holds back by hand, and keeps one
// GitHub issue current with that report. Run monthly by
// .github/workflows/pin-review.yml.
//
//   node scripts/pin-review.mts          build the report, then create or update the issue
//   node scripts/pin-review.mts --print  build the report and print it; no issue is touched
//
// The report states facts, not verdicts: what the registry and GitHub say
// today next to what is pinned and why. Whether a pin can be lifted is a
// judgement for review. Nothing here changes a dependency.
//
// Every ignore rule in the npm entry of dependabot.yml needs a handler
// below; a rule without one fails the run, so a new pin cannot go
// unreported. The gitleaks binary pinned in ci.yml is reported too, and
// so are three facts the CI gate cannot watch on a quiet repository: main's
// branch protection (the same reading as check-protection.mts), the
// domain's registry expiry date, read over RDAP, and that the repositories
// the site claims are public (the Career Application System and this one)
// still are. Renewal is automatic, but a lapse from a failed payment would
// take the site down with no other warning; a cited repository made private
// or deleted would leave a claim on the site that a reader cannot check.
// Failing to read protection, RDAP (a lapsed domain returns 404) or a cited
// repository never stops the report: each is reported as unreadable, so the
// dependency facts still publish.
//
// The issue is found by a hidden marker carrying a key of the facts that
// matter for a decision (majors, whether ESLint's next major is admitted,
// whether gitleaks moved and whether its pinned checksum still matches,
// whether protection holds, the domain's state: ok, near, expired or
// unreadable, and the state of any cited repository that is not public:
// private, missing or unreadable). Exact versions, the days remaining and error text are
// display only, so a patch release or another day passing changes nothing.
// An open issue is updated when its key differs. With none open, a new one
// is created only when the key differs from the most recently closed one,
// so closing the issue after review keeps it closed until something moves.

import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { BRANCH, defaultOriginUrl, readProtection, resolveRepo } from "./check-protection.mts";
import { isEntryPoint } from "./entry-point.mts";

export const ISSUE_TITLE = "Dependency pins to review";
export const PACKAGE_JSON = "package.json";
export const NVMRC = ".nvmrc";
export const DEPENDABOT_YML = ".github/dependabot.yml";
export const CI_YML = ".github/workflows/ci.yml";

const REGISTRY = "https://registry.npmjs.org";
const GITLEAKS_RELEASE = "https://api.github.com/repos/gitleaks/gitleaks/releases/latest";
export const DOMAIN = "shahrouzmohaghegh.com";
export const DOMAIN_RDAP = `https://rdap.verisign.com/com/v1/domain/${DOMAIN}`;
// The domain counts as near expiry within this many days. Registrars
// commonly run auto-renew during the final month, so a wider window (60
// days) would flag every healthy year before renewal had its chance; 21
// days still leaves three weeks to act once a renewal has failed.
export const DOMAIN_WINDOW_DAYS = 21;
const DAY_MS = 24 * 60 * 60 * 1000;
// The repositories the site claims are public: the Career Application
// System project and this website.
export const CITED_REPOS = ["shahrouzmohaghegh/career-application-system", "shahrouzmohaghegh/shahrouz-portfolio"] as const;
export const citedRepoApi = (repo: string): string => `https://api.github.com/repos/${repo}`;
const gitleaksChecksumsUrl = (version: string): string =>
  `https://github.com/gitleaks/gitleaks/releases/download/v${version}/gitleaks_${version}_checksums.txt`;

const MARKER_PREFIX = "<!-- pin-review key: ";
const MARKER = /<!-- pin-review key: (.*?) -->/;

// ---------------------------------------------------------------- parsers

export type IgnoreRule = { name: string; versions: string[]; reason: string };

const indentOf = (line: string): number => line.length - line.trimStart().length;
const isContent = (line: string): boolean => line.trim() !== "" && !line.trim().startsWith("#");
const unquote = (text: string): string => text.trim().replace(/^(["'])(.*)\1$/, "$2");

// Items of a YAML flow list such as [">= 6", '< 3', 4].
function flowList(text: string): string[] {
  const inner = text.trim().replace(/^\[/, "").replace(/\]$/, "");
  return [...inner.matchAll(/"([^"]*)"|'([^']*)'|([^,\s][^,]*)/g)].map((m) => (m[1] ?? m[2] ?? m[3]).trim());
}

// The ignore rules of the npm entry in dependabot.yml, in file order. The
// reason is the comment block directly above each rule, quoted as written.
// Handles flow and block lists and quoted names; not a general YAML parser.
export function parseIgnoreRules(yml: string): IgnoreRule[] {
  const lines = yml.replace(/\r\n/g, "\n").split("\n");
  const entry = /^\s*-\s*package-ecosystem:\s*(.+?)\s*$/;
  const start = lines.findIndex((line) => entry.test(line) && unquote(line.match(entry)![1]) === "npm");
  if (start === -1) throw new Error(`${DEPENDABOT_YML}: no npm entry under updates`);
  const entryIndent = indentOf(lines[start]);
  let end = start + 1;
  while (end < lines.length && !(isContent(lines[end]) && indentOf(lines[end]) <= entryIndent)) end++;

  const ignoreAt = lines.slice(start, end).findIndex((line) => /^\s*ignore:\s*$/.test(line));
  if (ignoreAt === -1) return [];
  const ignoreIndent = indentOf(lines[start + ignoreAt]);
  let ignoreEnd = start + ignoreAt + 1;
  while (ignoreEnd < end && !(isContent(lines[ignoreEnd]) && indentOf(lines[ignoreEnd]) <= ignoreIndent)) ignoreEnd++;

  const rules: IgnoreRule[] = [];
  for (let i = start + ignoreAt + 1; i < ignoreEnd; i++) {
    const name = lines[i].match(/^\s*-\s*dependency-name:\s*(.+?)\s*$/);
    if (!name) continue;
    const dash = indentOf(lines[i]);
    const comments: string[] = [];
    for (let j = i - 1; j >= 0 && /^\s*#/.test(lines[j]); j--) comments.unshift(lines[j].replace(/^\s*#\s?/, ""));
    const versions: string[] = [];
    for (let j = i + 1; j < ignoreEnd && !(isContent(lines[j]) && indentOf(lines[j]) <= dash); j++) {
      const key = lines[j].match(/^\s*versions:\s*(.*?)\s*$/);
      if (!key) continue;
      if (key[1].startsWith("[")) versions.push(...flowList(key[1]));
      else if (key[1] !== "") versions.push(unquote(key[1]));
      else {
        const keyIndent = indentOf(lines[j]);
        for (let k = j + 1; k < ignoreEnd && !(isContent(lines[k]) && indentOf(lines[k]) <= keyIndent); k++) {
          const item = lines[k].match(/^\s*-\s*(.+?)\s*$/);
          if (item) versions.push(unquote(item[1]));
        }
      }
    }
    rules.push({ name: unquote(name[1]), versions, reason: comments.join(" ") });
  }
  return rules;
}

export type GitleaksPin = { version: string; sha256: string };

export function parseGitleaksPin(ciYml: string): GitleaksPin {
  const version = ciYml.match(/^\s*GITLEAKS_VERSION:\s*"?([0-9][^"\s]*)"?\s*$/m);
  const sha256 = ciYml.match(/^\s*GITLEAKS_SHA256:\s*"?([0-9a-f]{64})"?\s*$/m);
  if (!version || !sha256) throw new Error(`${CI_YML}: GITLEAKS_VERSION or GITLEAKS_SHA256 not found`);
  return { version: version[1], sha256: sha256[1] };
}

// The SHA-256 of the linux x64 archive, from a gitleaks checksums file.
export function parseChecksum(checksums: string, version: string): string {
  const archive = `gitleaks_${version}_linux_x64.tar.gz`;
  for (const line of checksums.split("\n")) {
    const [sha, file] = line.trim().split(/\s+/);
    if (file === archive && /^[0-9a-f]{64}$/.test(sha)) return sha;
  }
  throw new Error(`checksums file has no SHA-256 for ${archive}`);
}

// The expiration event of an RDAP domain response, as an ISO timestamp.
export function parseExpiry(rdapJson: string): string {
  const rdap = JSON.parse(rdapJson) as { events?: { eventAction?: string; eventDate?: string }[] };
  const date = rdap.events?.find((event) => event.eventAction === "expiration")?.eventDate;
  if (!date || Number.isNaN(Date.parse(date))) throw new Error(`RDAP for ${DOMAIN} has no valid expiration event`);
  return date;
}

export function majorOf(version: string): number {
  const match = version.match(/\d+/);
  if (!match) throw new Error(`no major version in "${version}"`);
  return Number(match[0]);
}

// ----------------------------------------------------- semver ranges
//
// Just enough of npm's range grammar for two questions: does any version
// with a given major satisfy a range, and which published version is the
// highest to satisfy it. Each comparator becomes a half-open interval
// [lo, hi) of versions; an alternative is the intersection of its
// comparators. Prerelease tags are ignored. Unknown syntax gives null.

type Version = [number, number, number];
type Interval = { lo: Version; hi: Version };
const INF: Version = [Infinity, 0, 0];
const ZERO: Version = [0, 0, 0];

const cmp = (a: Version, b: Version): number => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];

// Numeric parts before the first wildcard, e.g. "7.2.x" -> [7, 2].
function partial(text: string): number[] | null {
  const parts = text.replace(/^v/, "").split("-")[0].split("+")[0].split(".");
  const nums: number[] = [];
  for (const part of parts) {
    if (part === "x" || part === "X" || part === "*") break;
    if (!/^\d+$/.test(part)) return null;
    nums.push(Number(part));
  }
  return nums.length > 3 ? null : nums;
}

const floor = (p: number[]): Version => [p[0] ?? 0, p[1] ?? 0, p[2] ?? 0];

// The first version past every version the partial matches.
function ceiling(p: number[]): Version {
  if (p.length === 0) return INF;
  if (p.length === 1) return [p[0] + 1, 0, 0];
  if (p.length === 2) return [p[0], p[1] + 1, 0];
  return [p[0], p[1], p[2] + 1];
}

function comparator(token: string): Interval | null {
  const match = token.match(/^(\^|~>?|>=|<=|>|<|=)?(.*)$/);
  if (!match) return null;
  const op = match[1] ?? "";
  const p = partial(match[2] || "*");
  if (!p) return null;
  switch (op) {
    case "":
    case "=":
      return { lo: floor(p), hi: ceiling(p) };
    case ">=":
      return { lo: floor(p), hi: INF };
    case ">":
      return { lo: ceiling(p), hi: INF };
    case "<":
      return { lo: ZERO, hi: floor(p) };
    case "<=":
      return { lo: ZERO, hi: ceiling(p) };
    case "~":
    case "~>":
      return { lo: floor(p), hi: ceiling(p.slice(0, Math.max(1, Math.min(p.length, 2)))) };
    case "^": {
      const keep = p[0] > 0 || p.length === 1 ? 1 : p[1] > 0 || p.length === 2 ? 2 : 3;
      return { lo: floor(p), hi: ceiling(p.slice(0, keep)) };
    }
  }
  return null;
}

function rangeIntervals(range: string): Interval[] | null {
  const spans: Interval[] = [];
  for (const alternative of range.split("||")) {
    const text = alternative.trim().replace(/(\^|~>?|>=|<=|>|<|=)\s+/g, "$1");
    const hyphen = text.match(/^(\S+)\s+-\s+(\S+)$/);
    const intervals = hyphen
      ? [comparator(`>=${hyphen[1]}`), comparator(`<=${hyphen[2]}`)]
      : text === ""
        ? [comparator("*")]
        : text.split(/\s+/).map(comparator);
    let span: Interval = { lo: ZERO, hi: INF };
    for (const interval of intervals) {
      if (!interval) return null;
      span = {
        lo: cmp(interval.lo, span.lo) > 0 ? interval.lo : span.lo,
        hi: cmp(interval.hi, span.hi) < 0 ? interval.hi : span.hi,
      };
    }
    spans.push(span);
  }
  return spans;
}

export function admitsMajor(range: string, major: number): boolean | null {
  const spans = rangeIntervals(range);
  if (!spans) return null;
  const target: Interval = { lo: [major, 0, 0], hi: [major + 1, 0, 0] };
  return spans.some((span) => {
    const lo = cmp(span.lo, target.lo) > 0 ? span.lo : target.lo;
    const hi = cmp(span.hi, target.hi) < 0 ? span.hi : target.hi;
    return cmp(lo, hi) < 0;
  });
}

// The highest release (no prerelease tag) satisfying the range, or null.
export function maxSatisfying(versions: string[], range: string): string | null {
  const spans = rangeIntervals(range);
  if (!spans) return null;
  let best: { text: string; v: Version } | null = null;
  for (const text of versions) {
    if (!/^\d+\.\d+\.\d+$/.test(text)) continue;
    const v = text.split(".").map(Number) as Version;
    const fits = spans.some((span) => cmp(v, span.lo) >= 0 && cmp(v, span.hi) < 0);
    if (fits && (!best || cmp(v, best.v) > 0)) best = { text, v };
  }
  return best ? best.text : null;
}

// ---------------------------------------------------------------- facts

// repo is owner/name for the protection reading, or null when unknown.
export type LocalFiles = { packageJson: string; nvmrc: string; dependabotYml: string; ciYml: string; repo: string | null };
export type FetchText = (url: string) => Promise<string>;

export type PinFacts =
  | { name: "typescript"; rule: IgnoreRule; pinned: string; latest: string }
  | { name: "@types/node"; rule: IgnoreRule; pinned: string; nvmrc: string; latest: string }
  | {
      name: "eslint";
      rule: IgnoreRule;
      pinned: string;
      configNext: { version: string; eslintPeer: string; pluginRange: string };
      plugin: { version: string; eslintPeer: string } | null;
    };

export type GitleaksFacts = {
  pinned: GitleaksPin;
  pinnedPublishedSha256: string;
  latest: string;
  latestSha256: string;
  checksumsFile: string;
};

export type DomainFacts =
  | { state: "ok" | "near" | "expired"; expires: string; daysRemaining: number }
  | { state: "unreadable"; reason: string };

export type ProtectionFacts =
  | { state: "intact"; repo: string }
  | { state: "drifted"; repo: string; problems: string[] }
  | { state: "unreadable"; reason: string };

// public: found and not private. missing: a 404, which GitHub also returns
// for a private repository the token cannot see.
export type CitedRepoFacts =
  | { repo: string; state: "public" | "private" | "missing" }
  | { repo: string; state: "unreadable"; reason: string };

export type Facts = {
  pins: PinFacts[];
  gitleaks: GitleaksFacts;
  protection: ProtectionFacts;
  domain: DomainFacts;
  citedRepos: CitedRepoFacts[];
};

type Manifest = {
  version: string;
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
};
type Context = { fetchJson: <T>(url: string) => Promise<T>; pinOf: (name: string) => string; local: LocalFiles };

const registryUrl = (name: string, tag = "latest"): string => `${REGISTRY}/${name.replace("/", "%2f")}/${tag}`;

const HANDLERS: Record<string, (rule: IgnoreRule, ctx: Context) => Promise<PinFacts>> = {
  typescript: async (rule, ctx) => ({
    name: "typescript",
    rule,
    pinned: ctx.pinOf("typescript"),
    latest: (await ctx.fetchJson<Manifest>(registryUrl("typescript"))).version,
  }),
  "@types/node": async (rule, ctx) => ({
    name: "@types/node",
    rule,
    pinned: ctx.pinOf("@types/node"),
    nvmrc: ctx.local.nvmrc.trim(),
    latest: (await ctx.fetchJson<Manifest>(registryUrl("@types/node"))).version,
  }),
  // ESLint arrives with eslint-config-next, whose eslint-plugin-import
  // dependency decides which ESLint majors work.
  eslint: async (rule, ctx) => {
    const config = await ctx.fetchJson<Manifest>(registryUrl("eslint-config-next"));
    const pluginRange = config.dependencies?.["eslint-plugin-import"];
    if (!pluginRange) throw new Error(`eslint-config-next ${config.version} does not depend on eslint-plugin-import`);
    const packument = await ctx.fetchJson<{ versions: Record<string, Manifest> }>(`${REGISTRY}/eslint-plugin-import`);
    const version = maxSatisfying(Object.keys(packument.versions), pluginRange);
    const peer = version ? packument.versions[version].peerDependencies?.eslint : undefined;
    return {
      name: "eslint",
      rule,
      pinned: ctx.pinOf("eslint"),
      configNext: { version: config.version, eslintPeer: config.peerDependencies?.eslint ?? "none", pluginRange },
      plugin: version ? { version, eslintPeer: peer ?? "none" } : null,
    };
  },
};

export const HANDLED_RULES = Object.keys(HANDLERS);

// The expiry as a UTC date, and whole days from now to it, rounded toward
// zero (so a negative count is whole days since expiry): expired once the
// expiry has passed, near at DOMAIN_WINDOW_DAYS or fewer.
export function domainFacts(expiry: string, now: Date): DomainFacts {
  const at = Date.parse(expiry);
  const daysRemaining = Math.trunc((at - now.getTime()) / DAY_MS) || 0;
  const state = at <= now.getTime() ? "expired" : daysRemaining <= DOMAIN_WINDOW_DAYS ? "near" : "ok";
  return { state, expires: new Date(at).toISOString().slice(0, 10), daysRemaining };
}

const errorText = (error: unknown): string => (error instanceof Error ? error.message : String(error));

async function readDomain(fetchText: FetchText, now: Date): Promise<DomainFacts> {
  try {
    return domainFacts(parseExpiry(await fetchText(DOMAIN_RDAP)), now);
  } catch (error) {
    return { state: "unreadable", reason: errorText(error) };
  }
}

// The repository response's private flag; anything else is unreadable, so a
// malformed body is never read as public.
export function parseRepoVisibility(text: string): "public" | "private" {
  const body: unknown = JSON.parse(text);
  const flag = typeof body === "object" && body !== null ? (body as { private?: unknown }).private : undefined;
  if (typeof flag !== "boolean") throw new Error("unexpected repository response: private is not a boolean");
  return flag ? "private" : "public";
}

async function readCitedRepo(fetchText: FetchText, repo: string): Promise<CitedRepoFacts> {
  try {
    return { repo, state: parseRepoVisibility(await fetchText(citedRepoApi(repo))) };
  } catch (error) {
    const reason = errorText(error);
    return /: HTTP 404$/.test(reason) ? { repo, state: "missing" } : { repo, state: "unreadable", reason };
  }
}

async function protectionFacts(fetchText: FetchText, repo: string | null): Promise<ProtectionFacts> {
  if (!repo) return { state: "unreadable", reason: "repository unknown: no GITHUB_REPOSITORY and no GitHub origin remote" };
  const reading = await readProtection(fetchText, repo);
  if (reading.state === "unreadable") return reading;
  return reading.problems.length === 0
    ? { state: "intact", repo }
    : { state: "drifted", repo, problems: reading.problems };
}

export async function collectFacts(fetchText: FetchText, local: LocalFiles, now: Date = new Date()): Promise<Facts> {
  const pkg = JSON.parse(local.packageJson) as { devDependencies?: Record<string, string> };
  const ctx: Context = {
    local,
    fetchJson: async <T,>(url: string): Promise<T> => JSON.parse(await fetchText(url)) as T,
    pinOf: (name) => {
      const range = pkg.devDependencies?.[name];
      if (!range) throw new Error(`${PACKAGE_JSON}: no devDependency ${name}`);
      return range;
    },
  };

  const rules = parseIgnoreRules(local.dependabotYml);
  const unhandled = rules.filter((rule) => !(rule.name in HANDLERS)).map((rule) => rule.name);
  if (unhandled.length > 0) {
    throw new Error(`${DEPENDABOT_YML}: no pin-review handler for ignore rule(s): ${unhandled.join(", ")}`);
  }
  const pins: PinFacts[] = [];
  for (const rule of rules) pins.push(await HANDLERS[rule.name](rule, ctx));

  const pinned = parseGitleaksPin(local.ciYml);
  const pinnedPublishedSha256 = parseChecksum(await fetchText(gitleaksChecksumsUrl(pinned.version)), pinned.version);
  const release = await ctx.fetchJson<{ tag_name: string; assets: { name: string; browser_download_url: string }[] }>(
    GITLEAKS_RELEASE,
  );
  const latest = release.tag_name.replace(/^v/, "");
  const asset = release.assets.find((a) => a.name.endsWith("checksums.txt"));
  if (!asset) throw new Error(`gitleaks ${release.tag_name} publishes no checksums.txt`);
  const latestSha256 = parseChecksum(await fetchText(asset.browser_download_url), latest);

  const protection = await protectionFacts(fetchText, local.repo);
  const domain = await readDomain(fetchText, now);
  const citedRepos: CitedRepoFacts[] = [];
  for (const repo of CITED_REPOS) citedRepos.push(await readCitedRepo(fetchText, repo));

  return {
    pins,
    gitleaks: { pinned, pinnedPublishedSha256, latest, latestSha256, checksumsFile: asset.name },
    protection,
    domain,
    citedRepos,
  };
}

// ---------------------------------------------------------------- report

const yesNo = (value: boolean | null): string => (value === null ? "range not understood" : value ? "yes" : "no");

// The facts a decision depends on. Exact versions are left out on purpose.
export function reportKey(facts: Facts): string {
  const key: Record<string, Record<string, number | boolean | string | string[] | null>> = {};
  for (const pin of facts.pins) {
    const pinnedMajor = majorOf(pin.pinned);
    if (pin.name === "typescript") key[pin.name] = { pinnedMajor, latestMajor: majorOf(pin.latest) };
    if (pin.name === "@types/node") key[pin.name] = { pinnedMajor, nvmrcMajor: majorOf(pin.nvmrc) };
    if (pin.name === "eslint") {
      key[pin.name] = {
        pinnedMajor,
        pluginAdmitsNext: pin.plugin ? admitsMajor(pin.plugin.eslintPeer, pinnedMajor + 1) : null,
        configNextAdmitsNext: admitsMajor(pin.configNext.eslintPeer, pinnedMajor + 1),
      };
    }
  }
  const g = facts.gitleaks;
  key.gitleaks = {
    latestEqualsPinned: g.latest === g.pinned.version,
    pinnedChecksumMatches: g.pinnedPublishedSha256 === g.pinned.sha256,
  };
  key.protection = {
    state: facts.protection.state,
    problems: facts.protection.state === "drifted" ? facts.protection.problems : [],
  };
  key.domain = { state: facts.domain.state };
  // Only a repository that is not public enters the key. With every one
  // public the key is the one written before cited repositories were
  // watched, so adding the watch reopens no issue and recreates none.
  const notPublic = facts.citedRepos.filter((repo) => repo.state !== "public");
  if (notPublic.length > 0) key.citedRepos = Object.fromEntries(notPublic.map((repo) => [repo.repo, repo.state]));
  return JSON.stringify(key);
}

function pinSection(pin: PinFacts): string[] {
  const head = [
    `## ${pin.name} (pinned \`${pin.pinned}\`)`,
    "",
    `Dependabot ignores ${pin.rule.versions.map((v) => `\`${v}\``).join(", ")}. ` +
      `Reason, from \`${DEPENDABOT_YML}\`: ${pin.rule.reason}`,
    "",
  ];
  const pinnedMajor = majorOf(pin.pinned);
  if (pin.name === "typescript") {
    return [
      ...head,
      `- latest: ${pin.latest} (major ${majorOf(pin.latest)})`,
      `- pinned major: ${pinnedMajor}`,
      `- latest major equals pinned major: ${yesNo(majorOf(pin.latest) === pinnedMajor)}`,
    ];
  }
  if (pin.name === "@types/node") {
    return [
      ...head,
      `- Node major in \`${NVMRC}\`: ${majorOf(pin.nvmrc)}`,
      `- pinned major: ${pinnedMajor}`,
      `- pinned major matches \`${NVMRC}\`: ${yesNo(majorOf(pin.nvmrc) === pinnedMajor)}`,
      `- npm latest, for reference: ${pin.latest}`,
    ];
  }
  const next = pinnedMajor + 1;
  return [
    ...head,
    `- eslint-config-next latest: ${pin.configNext.version}`,
    `- its own \`eslint\` peer range: \`${pin.configNext.eslintPeer}\`; admits ESLint ${next}: ${yesNo(admitsMajor(pin.configNext.eslintPeer, next))}`,
    `- its \`eslint-plugin-import\` range: \`${pin.configNext.pluginRange}\``,
    pin.plugin
      ? `- highest eslint-plugin-import in that range: ${pin.plugin.version}, \`eslint\` peer range ` +
        `\`${pin.plugin.eslintPeer}\`; admits ESLint ${next}: ${yesNo(admitsMajor(pin.plugin.eslintPeer, next))}`
      : "- no published eslint-plugin-import version satisfies that range",
  ];
}

const PROTECTION_CHECKED = "protected, required checks enforced for admins too, and `gate` required";

function domainLine(domain: DomainFacts): string {
  if (domain.state === "unreadable") return `${DOMAIN} expiry could not be read`;
  if (domain.state === "expired") return `${DOMAIN} expired ${-domain.daysRemaining} days ago`;
  return `${DOMAIN} expires in ${domain.daysRemaining} days`;
}

function citedRepoLine(repo: CitedRepoFacts): string {
  if (repo.state === "private") return `${repo.repo} is private`;
  if (repo.state === "missing") return `${repo.repo} was not found`;
  return `${repo.repo} could not be read`;
}

// One line naming whatever needs action now, or null when nothing does.
export function alertLine(facts: Facts): string | null {
  const parts: string[] = [];
  if (facts.protection.state === "drifted") parts.push(`${BRANCH} protection has drifted`);
  if (facts.protection.state === "unreadable") parts.push(`${BRANCH} protection could not be read`);
  if (facts.domain.state !== "ok") parts.push(domainLine(facts.domain));
  for (const repo of facts.citedRepos) if (repo.state !== "public") parts.push(citedRepoLine(repo));
  return parts.length > 0 ? `**Needs attention:** ${parts.join("; ")}. Details below.` : null;
}

function protectionSection(protection: ProtectionFacts): string[] {
  const head = [
    `## branch protection (${BRANCH})`,
    "",
    `The same reading as the CI gate's \`scripts/check-protection.mts\`: ${PROTECTION_CHECKED}. ` +
      "Pull request, strict and force push settings are not visible without an admin token and are not checked.",
    "",
  ];
  if (protection.state === "unreadable") return [...head, `- state: unreadable (${protection.reason})`];
  if (protection.state === "intact") return [...head, `- state: intact, in ${protection.repo}`];
  return [...head, `- state: drifted, in ${protection.repo}`, ...protection.problems.map((p) => `  - ${p}`)];
}

function domainSection(domain: DomainFacts): string[] {
  const head = [
    `## domain (${DOMAIN})`,
    "",
    `Set to renew automatically; this catches a renewal that failed. From the registry over RDAP, \`${DOMAIN_RDAP}\`. ` +
      `Flagged as near within ${DOMAIN_WINDOW_DAYS} days of expiry, late enough not to fire before the registrar's own ` +
      "auto-renew in a healthy year, early enough to act on a failed one.",
    "",
  ];
  if (domain.state === "unreadable") return [...head, `- state: unreadable (${domain.reason})`];
  return [
    ...head,
    `- state: ${domain.state}`,
    `- expires: ${domain.expires}`,
    domain.state === "expired"
      ? `- expired ${-domain.daysRemaining} days ago`
      : `- days remaining: ${domain.daysRemaining}`,
  ];
}

function citedRepoSection(repo: CitedRepoFacts): string[] {
  const head = [
    `## cited repository (${repo.repo})`,
    "",
    `The site cites https://github.com/${repo.repo} as a public repository. From \`${citedRepoApi(repo.repo)}\`; ` +
      "a 404 means deleted, renamed or made private.",
    "",
  ];
  if (repo.state === "unreadable") return [...head, `- state: unreadable (${repo.reason})`];
  return [...head, `- state: ${repo.state}`];
}

export function buildReport(facts: Facts): string {
  const g = facts.gitleaks;
  const alert = alertLine(facts);
  const lines = [
    `${MARKER_PREFIX}${reportKey(facts)} -->`,
    `<!-- Written by scripts/pin-review.mts (.github/workflows/pin-review.yml). Manual edits are overwritten. -->`,
    "",
    ...(alert ? [alert, ""] : []),
    "Facts from the npm registry and GitHub releases for each version this project holds back by hand, " +
      "with main's branch protection, the domain's expiry date from the .com registry and the cited repositories' visibility. " +
      "Whether a pin can be lifted is a judgement for review; nothing here changes a dependency. " +
      "Close this issue after review: it returns only when a major, a peer range verdict or the gitleaks pin moves, " +
      "or when protection, the domain or a cited repository changes state; patch releases alone do not reopen it.",
    "",
  ];
  for (const pin of facts.pins) lines.push(...pinSection(pin), "");
  lines.push(
    `## gitleaks (hand-pinned in \`${CI_YML}\`)`,
    "",
    "Dependabot does not track this pin.",
    "",
    `- pinned: ${g.pinned.version}, SHA-256 \`${g.pinned.sha256}\``,
    `- pinned SHA-256 matches the published checksum for ${g.pinned.version}: ${yesNo(g.pinnedPublishedSha256 === g.pinned.sha256)}`,
    `- latest release: ${g.latest}`,
    `- latest release equals pinned: ${yesNo(g.latest === g.pinned.version)}`,
    `- linux x64 SHA-256 of ${g.latest}, from \`${g.checksumsFile}\`: \`${g.latestSha256}\``,
    "",
    ...protectionSection(facts.protection),
    "",
    ...domainSection(facts.domain),
    "",
    ...facts.citedRepos.flatMap((repo) => ["", ...citedRepoSection(repo)]).slice(1),
  );
  return lines.join("\n") + "\n";
}

// ---------------------------------------------------------------- issue

export type Issue = { number: number; title: string; body: string; state: string; closedAt: string | null };
export type Decision = { action: "none"; reason: string } | { action: "update"; number: number } | { action: "create" };

export const markerOf = (body: string): string | null => body.match(MARKER)?.[1] ?? null;

// Issues are recognised by the marker, not the title, so a renamed issue is
// still found.
export function decideIssue(report: string, issues: Issue[]): Decision {
  const key = markerOf(report);
  const ours = issues.filter((issue) => markerOf(issue.body) !== null);
  const open = ours.filter((issue) => issue.state.toUpperCase() === "OPEN").sort((a, b) => b.number - a.number);
  if (open.length > 0) {
    return markerOf(open[0].body) === key
      ? { action: "none", reason: `issue #${open[0].number} is open and current` }
      : { action: "update", number: open[0].number };
  }
  const closed = ours
    .filter((issue) => issue.state.toUpperCase() === "CLOSED")
    .sort((a, b) => (b.closedAt ?? "").localeCompare(a.closedAt ?? "") || b.number - a.number);
  if (closed.length > 0 && markerOf(closed[0].body) === key) {
    return { action: "none", reason: `nothing moved since issue #${closed[0].number} was closed` };
  }
  return { action: "create" };
}

export type Gh = (args: string[], input?: string) => string;

// Applies the decision through gh. The body goes on stdin.
export function syncIssue(report: string, gh: Gh): string {
  const issues = JSON.parse(
    gh(["issue", "list", "--state", "all", "--limit", "1000", "--json", "number,title,body,state,closedAt"]),
  ) as Issue[];
  const decision = decideIssue(report, issues);
  if (decision.action === "update") {
    gh(["issue", "edit", String(decision.number), "--body-file", "-"], report);
    return `updated issue #${decision.number}`;
  }
  if (decision.action === "create") {
    gh(["issue", "create", "--title", ISSUE_TITLE, "--body-file", "-"], report);
    return "created a new issue";
  }
  return `no change: ${decision.reason}`;
}

// ---------------------------------------------------------------- CLI

async function defaultFetch(url: string): Promise<string> {
  const headers: Record<string, string> = { "User-Agent": "shahrouz-portfolio-pin-review" };
  const token = process.env.GH_TOKEN;
  if (token && url.startsWith("https://api.github.com/")) headers.Authorization = `Bearer ${token}`;
  // The abbreviated packument still carries peerDependencies, at a
  // fraction of the size.
  if (url.startsWith(REGISTRY)) headers.Accept = "application/vnd.npm.install-v1+json; q=1.0, application/json; q=0.8";
  const response = await fetch(url, { headers });
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return response.text();
}

function defaultGh(args: string[], input?: string): string {
  const result = spawnSync("gh", args, { input, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (result.status !== 0) {
    throw new Error(`gh ${args.slice(0, 2).join(" ")} failed: ${result.error?.message ?? result.stderr.trim()}`);
  }
  return result.stdout;
}

function readLocal(): LocalFiles {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  const read = (path: string): string => readFileSync(join(root, path), "utf8");
  return {
    packageJson: read(PACKAGE_JSON),
    nvmrc: read(NVMRC),
    dependabotYml: read(DEPENDABOT_YML),
    ciYml: read(CI_YML),
    repo: resolveRepo({ GITHUB_REPOSITORY: process.env.GITHUB_REPOSITORY }, defaultOriginUrl),
  };
}

export type Deps = {
  fetchText: FetchText;
  gh: Gh;
  readLocal: () => LocalFiles;
  out: (text: string) => void;
  err: (text: string) => void;
};

const DEFAULT_DEPS: Deps = {
  fetchText: defaultFetch,
  gh: defaultGh,
  readLocal,
  out: (text) => process.stdout.write(text),
  err: (text) => console.error(text),
};

// Rejects on any fetch or gh failure; the report is complete before any
// issue is touched, so a failure never writes a partial one.
export async function main(argv: string[], deps: Deps = DEFAULT_DEPS): Promise<number> {
  const unknown = argv.filter((arg) => arg !== "--print");
  if (unknown.length > 0) {
    deps.err(`pin-review: unknown argument(s): ${unknown.join(" ")}`);
    return 1;
  }
  const report = buildReport(await collectFacts(deps.fetchText, deps.readLocal()));
  deps.out(report);
  if (!argv.includes("--print")) deps.err(`pin-review: ${syncIssue(report, deps.gh)}`);
  return 0;
}

const invokedDirectly = isEntryPoint(import.meta.url);
if (invokedDirectly) {
  main(process.argv.slice(2)).then(
    (code) => process.exit(code),
    (error: unknown) => {
      console.error(`pin-review: ${error instanceof Error ? error.message : String(error)}; no issue written`);
      process.exit(1);
    },
  );
}
