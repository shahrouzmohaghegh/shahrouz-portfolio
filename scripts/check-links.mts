// Every link on the running site works, and every repository it points at
// is on a public allowlist of repositories (Story 3.6). Run in the gate against `next start`,
// after the build:
//
//   node scripts/check-links.mts <base-url>     e.g. http://localhost:3000
//
// 1. Internal crawl. From <base-url>/, every same-origin <a href> is
//    followed, query and fragment stripped, each page fetched once without
//    following redirects. A link to the site's canonical origin
//    (CANONICAL_ORIGINS) is internal too, mapped onto <base-url>. The crawl
//    fails clearly past MAX_PAGES pages. A page must answer 200, except the two not-found pages
//    (/case-study-not-available, /project-not-available) and any
//    /experience/<slug> or /projects/<slug> whose slug is not on its
//    written list: proxy.ts answers those with a 404 by design, so 404 is
//    what they must answer. A written detail page answering 404 fails. The
//    two not-found pages are always fetched, linked or not.
// 2. External links. Every distinct http(s) href on any crawled page, plus
//    each project's repository URL read from content/projects (so the
//    repository links are checked before any project page is written), is
//    fetched with GET, redirects followed, a timeout and a User-Agent naming
//    the site. The final status must be 200. A URL that does not answer 200
//    is tried twice more, with a short backoff. After that, a 999 or 429
//    from www.linkedin.com only (BOT_BLOCK_EXEMPTION) is reported as
//    "blocked automated access, not checked" and does not fail: LinkedIn
//    refuses CI runners that way. Any other status, LinkedIn's 404
//    included, and a network error on every attempt, fail.
// 3. Repository links. The content model's repository URLs must be exactly
//    EXPECTED_REPOSITORIES. On a written project page, every github.com
//    link must equal that project's repository, and the page must carry it.
// 4. Allowlist. Any href, internal, external or otherwise, and anything in a
//    crawled page's whole HTML (scripts included), that points at a
//    repository under the owner shahrouzmohaghegh fails unless that
//    repository is on the public allowlist of repositories
//    (ALLOWED_REPOSITORIES): career-application-system and
//    shahrouz-portfolio. Every form counts:
//    any case, a port, with or without .git, a path, query or fragment, the
//    ssh and scp remotes, www., api.github.com/repos and
//    raw.githubusercontent.com, a percent-encoded slash, JSON-escaped
//    slashes and HTML entities. The owner's profile root, with no
//    repository, is allowed. The failure names no repository.
// 5. mailto: links must name one address and carry no query. Any other
//    scheme fails.
// 6. No CV document (FR-23). Any href on a crawled page whose path ends in
//    a document extension (DOCUMENT_EXTENSIONS: .pdf, .doc, .docx, .rtf,
//    .odt) or names cv or resume as a word (CV_WORDS) fails and is never
//    fetched. The site offers no CV, generic or otherwise: every CV is
//    written for one job and sent by email.
//
// Exit 1 names each failure: the page or link, the status, and the pages it
// was found on. Built-ins only; the HTTP layer is injected, so the tests
// touch no network.

import { writtenCaseStudySlugs } from "../content/case-studies/index.ts";
import { projects, writtenProjectSlugs } from "../content/projects/index.ts";
import { isEntryPoint } from "./entry-point.mts";

export const USER_AGENT = "shahrouzmohaghegh.com link check (+https://shahrouzmohaghegh.com/)";
export const TIMEOUT_MS = 20_000;
// Attempts per external URL: the first, then two retries.
export const ATTEMPTS = 3;
export const BACKOFF_MS = [2_000, 5_000] as const;
// External URLs fetched at once.
export const CONCURRENCY = 4;
// The crawl fails past this many pages, so a link loop cannot run forever.
export const MAX_PAGES = 200;

// The production origins: a link to either is a link to this site, so it is
// crawled against the base URL rather than fetched from production.
export const CANONICAL_ORIGINS = ["https://shahrouzmohaghegh.com", "https://www.shahrouzmohaghegh.com"] as const;

// The two static not-found pages, as lib/not-found-rewrite.ts names them
// (the test pins the two together).
export const NOT_FOUND_PAGES = ["/case-study-not-available", "/project-not-available"] as const;

// Where each kind's detail pages live, with the slugs that have a page.
export const DETAIL_ROUTES = [
  { prefix: "/experience/", written: writtenCaseStudySlugs },
  { prefix: "/projects/", written: writtenProjectSlugs },
] as const;

// The one host whose bot block is tolerated, and the statuses that mean it.
export const BOT_BLOCK_EXEMPTION = { host: "www.linkedin.com", statuses: [999, 429] } as const;

// Each project's public repository (epic 3): PR-1 and PR-2. PR-3 has none.
export const EXPECTED_REPOSITORIES: Readonly<Record<string, string>> = {
  "career-application-system": "https://github.com/shahrouzmohaghegh/career-application-system",
  "this-website": "https://github.com/shahrouzmohaghegh/shahrouz-portfolio",
};

// The public allowlist of repositories: the only repositories under the
// owner that the site may point at. GitHub names are case-insensitive, so
// they are compared in lower case.
export const ALLOWED_REPOSITORIES = ["career-application-system", "shahrouz-portfolio"] as const;

// The one failure wording for a repository off the allowlist. It never names
// the repository, so a report cannot publish the name it guards.
export const NOT_ALLOWED = "points at a repository that is not on the public allowlist";

// A repository under the owner, in any form: https, http, no scheme, www., a
// port, an ssh or scp remote (git@github.com:), api.github.com/repos and
// raw.githubusercontent.com; group 1 is the repository name as written.
// The owner's profile root, with no name after it, does not match.
export const OWNER_REPOSITORY =
  /(?:(?:www\.)?github\.com(?::\d+)?[/:]+|api\.github\.com(?::\d+)?\/+repos\/+|raw\.githubusercontent\.com(?::\d+)?\/+)shahrouzmohaghegh\/+([A-Za-z0-9_.-]+)/gi;

// The repository a matched name refers to: a trailing .git and any full
// stops ending a sentence dropped, lower-cased.
export const repositoryName = (written: string): string => written.replace(/\.+$/, "").replace(/\.git$/i, "").replace(/\.+$/, "").toLowerCase();

const unlistedIn = (text: string): boolean =>
  [...text.matchAll(OWNER_REPOSITORY)].some((match) => {
    const name = repositoryName(match[1]);
    return name !== "" && !(ALLOWED_REPOSITORIES as readonly string[]).includes(name);
  });

// Whether a link points at a repository under the owner that is off the
// allowlist, as written or percent-decoded.
export function pointsAtUnlistedRepository(text: string): boolean {
  if (unlistedIn(text)) return true;
  try {
    return unlistedIn(decodeURIComponent(text));
  } catch {
    return unlistedIn(text.replace(/%2f/gi, "/"));
  }
}

// A whole page body, scripts included: as served, entity-decoded, with
// JSON's escaped slashes (\/ and \u002f) and percent-encoded slashes undone.
export function bodyPointsAtUnlistedRepository(html: string): boolean {
  const unescaped = html.replace(/\\u002f/gi, "/").replace(/\\\//g, "/").replace(/%2f/gi, "/");
  return [html, decodeEntities(html), unescaped, decodeEntities(unescaped)].some(unlistedIn);
}

// ---------------------------------------------------------------- CV documents

// FR-23: no route links a CV, resume or profile document.
export const DOCUMENT_EXTENSIONS = ["pdf", "doc", "docx", "rtf", "odt"] as const;
export const CV_WORDS = ["cv", "resume"] as const;
export const CV_DOCUMENT = "links to a CV, resume or document file; the site offers none (FR-23)";

// Why an href is a CV or document link, or null. Only the path counts, as
// written and percent-decoded, lower-cased and with accents dropped (so
// résumé is resume): a final extension from DOCUMENT_EXTENSIONS, or cv or
// resume as a whole word between non-alphanumerics. mailto: and other
// non-http schemes have no path to judge and pass.
export function cvDocumentProblem(href: string): string | null {
  let url: URL;
  try {
    url = new URL(href, "http://site.invalid/");
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  let path = url.pathname;
  try {
    path = decodeURIComponent(path);
  } catch {
    // keep the encoded form
  }
  path = path.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const extension = /\.([a-z0-9]+)\/*$/.exec(path)?.[1];
  if (extension !== undefined && (DOCUMENT_EXTENSIONS as readonly string[]).includes(extension)) return CV_DOCUMENT;
  const words = path.split(/[^a-z0-9]+/);
  return words.some((word) => (CV_WORDS as readonly string[]).includes(word)) ? CV_DOCUMENT : null;
}

// ---------------------------------------------------------------- extraction

const NAMED: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", sol: "/", colon: ":", period: "." };

// Named entities from a small set, and every numeric one, decimal or hex in
// any case.
export const decodeEntities = (value: string): string =>
  value.replace(/&(?:#[xX]([0-9a-fA-F]+)|#([0-9]+)|([A-Za-z]+));/g, (whole, hex?: string, dec?: string, name?: string) => {
    if (name !== undefined) return NAMED[name] ?? whole;
    const point = hex !== undefined ? parseInt(hex, 16) : parseInt(dec as string, 10);
    try {
      return String.fromCodePoint(point);
    } catch {
      return whole;
    }
  });

// The href of every <a> and <area>, entity-decoded and trimmed, in document
// order. Comments, scripts and styles are skipped.
export function extractHrefs(html: string): string[] {
  const text = html.replace(/<!--[\s\S]*?-->/g, "").replace(/<(script|style)\b[\s\S]*?<\/\1\s*>/gi, "");
  const hrefs: string[] = [];
  for (const tag of text.matchAll(/<(?:a|area)\b[^>]*>/gi)) {
    const match = /\shref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(tag[0]);
    if (match) hrefs.push(decodeEntities(match[1] ?? match[2] ?? match[3]).trim());
  }
  return hrefs;
}

export type Classified =
  | { kind: "internal"; path: string }
  | { kind: "external"; url: string }
  | { kind: "mailto"; address: string; query: string }
  | { kind: "other"; reason: string };

// One href found on pageUrl, against the site's origin. Internal paths lose
// their query and fragment; the canonical origins count as internal.
export function classify(href: string, pageUrl: string, origin: string): Classified {
  if (/^mailto:/i.test(href)) {
    const rest = href.slice("mailto:".length);
    const at = rest.indexOf("?");
    return { kind: "mailto", address: at === -1 ? rest : rest.slice(0, at), query: at === -1 ? "" : rest.slice(at + 1) };
  }
  let url: URL;
  try {
    url = new URL(href, pageUrl);
  } catch {
    return { kind: "other", reason: "not a valid URL" };
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return { kind: "other", reason: `unsupported scheme ${url.protocol}` };
  if (url.origin === origin || (CANONICAL_ORIGINS as readonly string[]).includes(url.origin)) {
    return { kind: "internal", path: url.pathname };
  }
  url.hash = "";
  return { kind: "external", url: url.href };
}

const ONE_ADDRESS = /^[^\s@,;<>()]+@[^\s@,;<>()]+\.[^\s@,;<>().]+$/;

// A mailto is checked for form only: one address, no query.
export function mailtoProblem(address: string, query: string): string | null {
  if (query !== "") return "carries a query";
  let decoded: string;
  try {
    decoded = decodeURIComponent(address);
  } catch {
    return "is not valid percent-encoding";
  }
  return ONE_ADDRESS.test(decoded) ? null : "does not name exactly one address";
}

// The status a site path must answer: 404 for the not-found pages and any
// detail slug not written, 200 for everything else.
export function expectedStatus(path: string, routes: ReadonlyArray<{ prefix: string; written: readonly string[] }> = DETAIL_ROUTES): 200 | 404 {
  const pathname = path.split("?")[0];
  if ((NOT_FOUND_PAGES as readonly string[]).includes(pathname)) return 404;
  for (const { prefix, written } of routes) {
    if (!pathname.startsWith(prefix)) continue;
    const rest = pathname.slice(prefix.length).replace(/\/$/, "");
    if (rest === "" || rest.includes("/")) continue;
    let slug: string;
    try {
      slug = decodeURIComponent(rest);
    } catch {
      return 404;
    }
    return written.includes(slug) ? 200 : 404;
  }
  return 200;
}

// The written project a path is the page of, or null.
export function writtenProjectOf(path: string, written: readonly string[] = writtenProjectSlugs): string | null {
  const match = /^\/projects\/([^/?]+)\/?(?:\?.*)?$/.exec(path);
  if (match === null) return null;
  try {
    const slug = decodeURIComponent(match[1]);
    return written.includes(slug) ? slug : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------- HTTP

// One request. Rejects on a network error or timeout; any status resolves.
export type HttpResponse = { status: number; body: string };
export type Http = (url: string, options: { follow: boolean }) => Promise<HttpResponse>;
export type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

// Internal pages are read whole, never following a redirect, so a redirect
// fails as a non-200. External ones follow redirects and drop the body.
export function makeHttp(fetchImpl: FetchLike = fetch, timeoutMs = TIMEOUT_MS): Http {
  return async (url, { follow }) => {
    const response = await fetchImpl(url, {
      method: "GET",
      redirect: follow ? "follow" : "manual",
      headers: { "User-Agent": USER_AGENT, Accept: "text/html,*/*;q=0.8" },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (follow) {
      await response.body?.cancel().catch(() => {});
      return { status: response.status, body: "" };
    }
    return { status: response.status, body: await response.text() };
  };
}

const errorText = (error: unknown): string => (error instanceof Error ? error.message : String(error));

// ---------------------------------------------------------------- check

export type Failure = { subject: string; detail: string; foundOn: string[] };
export type ExternalResult = { url: string; outcome: "ok" | "blocked" | "failed"; detail: string; foundOn: string[] };
export type PageResult = { path: string; status: number | null; expected: 200 | 404 };
export type Result = { pages: PageResult[]; external: ExternalResult[]; mailto: number; failures: Failure[] };

export type Deps = {
  http: Http;
  sleep: (ms: number) => Promise<void>;
  projects?: ReadonlyArray<{ slug: string; repository?: string }>;
  writtenProjects?: readonly string[];
  maxPages?: number;
};

const MODEL_SOURCE = "content/projects/index.ts";

// Whether a URL's attempts were a bot block: the exempt host, and every
// attempt that got an HTTP answer got an exempt status (network errors in
// between do not count either way). At least one HTTP answer is needed.
export function isBotBlock(url: string, statuses: readonly number[]): boolean {
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return false;
  }
  const exempt = BOT_BLOCK_EXEMPTION.statuses as readonly number[];
  return host === BOT_BLOCK_EXEMPTION.host && statuses.length > 0 && statuses.every((status) => exempt.includes(status));
}

// One external URL: up to ATTEMPTS tries until 200, then the verdict.
export async function checkExternal(url: string, deps: Pick<Deps, "http" | "sleep">): Promise<{ outcome: ExternalResult["outcome"]; detail: string }> {
  let last = "";
  const statuses: number[] = [];
  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    if (attempt > 1) await deps.sleep(BACKOFF_MS[attempt - 2] ?? BACKOFF_MS[BACKOFF_MS.length - 1]);
    try {
      const status = (await deps.http(url, { follow: true })).status;
      if (status === 200) return { outcome: "ok", detail: "HTTP 200" };
      statuses.push(status);
      last = `HTTP ${status}`;
    } catch (error) {
      last = `no answer: ${errorText(error)}`;
    }
  }
  if (isBotBlock(url, statuses)) {
    return { outcome: "blocked", detail: `HTTP ${[...new Set(statuses)].join(" and ")}: blocked automated access, not checked` };
  }
  return { outcome: "failed", detail: `${last} after ${ATTEMPTS} attempts, not 200` };
}

// Runs task over every item, at most limit at once, results in item order.
export async function mapLimited<T, R>(items: readonly T[], limit: number, task: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const worker = async (): Promise<void> => {
    while (next < items.length) {
      const index = next++;
      results[index] = await task(items[index]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

const note = (map: Map<string, Set<string>>, key: string, page: string): void => {
  const pages = map.get(key) ?? new Set<string>();
  pages.add(page);
  map.set(key, pages);
};

export async function checkLinks(baseUrl: string, deps: Deps): Promise<Result> {
  const origin = new URL(baseUrl).origin;
  const projectList = deps.projects ?? projects;
  const writtenProjects = deps.writtenProjects ?? writtenProjectSlugs;
  const routes = DETAIL_ROUTES.map((route) => (route.prefix === "/projects/" ? { ...route, written: writtenProjects } : route));
  const failures: Failure[] = [];
  const fail = (subject: string, detail: string, foundOn: Iterable<string> = []): void => {
    failures.push({ subject, detail, foundOn: [...foundOn] });
  };

  // The content model's repositories are what the pages will link.
  const repositoryOf = new Map<string, string>();
  for (const project of projectList) {
    if (project.repository !== undefined) repositoryOf.set(project.slug, project.repository);
  }
  // An unlisted repository is reported by the allowlist wording alone, so
  // its URL never reaches the report.
  const unlisted = new Set<string>();
  for (const [slug, url] of repositoryOf) {
    if (pointsAtUnlistedRepository(url)) {
      unlisted.add(slug);
      fail(`project ${slug}`, `repository ${NOT_ALLOWED}`, [MODEL_SOURCE]);
    }
  }
  for (const [slug, url] of Object.entries(EXPECTED_REPOSITORIES)) {
    const actual = repositoryOf.get(slug);
    if (actual !== url && !unlisted.has(slug)) fail(`project ${slug}`, `repository is ${actual ?? "missing"}, expected ${url}`, [MODEL_SOURCE]);
  }
  for (const [slug, url] of repositoryOf) {
    if (!(slug in EXPECTED_REPOSITORIES) && !unlisted.has(slug)) {
      fail(`project ${slug}`, `repository ${url} is not one of the expected public repositories`, [MODEL_SOURCE]);
    }
  }

  const externalFoundOn = new Map<string, Set<string>>();
  for (const [slug, url] of repositoryOf) {
    if (!unlisted.has(slug)) note(externalFoundOn, url, MODEL_SOURCE);
  }

  // Breadth-first crawl, each path once.
  const pages: PageResult[] = [];
  const queue: string[] = ["/", ...NOT_FOUND_PAGES];
  const seen = new Set(queue);
  const internalFoundOn = new Map<string, Set<string>>();
  const mailtos = new Set<string>();
  const maxPages = deps.maxPages ?? MAX_PAGES;
  while (queue.length > 0) {
    if (pages.length >= maxPages) {
      fail("crawl", `stopped after ${maxPages} pages with ${queue.length} still queued; the site should not have this many pages, so look for a link loop`, []);
      break;
    }
    const path = queue.shift() as string;
    const pageUrl = new URL(path, origin).href;
    const expected = expectedStatus(path, routes);
    let response: HttpResponse;
    try {
      response = await deps.http(pageUrl, { follow: false });
    } catch (error) {
      pages.push({ path, status: null, expected });
      fail(path, `no answer: ${errorText(error)}`, internalFoundOn.get(path) ?? []);
      continue;
    }
    pages.push({ path, status: response.status, expected });
    if (response.status !== expected) {
      fail(path, `HTTP ${response.status}, expected ${expected}`, internalFoundOn.get(path) ?? []);
      if (response.status >= 300 && response.status < 400) continue;
    }

    const hrefs = extractHrefs(response.body);
    const writtenSlug = writtenProjectOf(path, writtenProjects);
    const githubLinks: string[] = [];
    let unlistedHref = false;
    for (const href of hrefs) {
      if (pointsAtUnlistedRepository(href)) {
        unlistedHref = true;
        fail("a link", NOT_ALLOWED, [path]);
        continue;
      }
      if (cvDocumentProblem(href) !== null) {
        fail(href, CV_DOCUMENT, [path]);
        continue;
      }
      const link = classify(href, pageUrl, origin);
      if (link.kind === "internal") {
        const target = link.path;
        note(internalFoundOn, target, path);
        if (!seen.has(target)) {
          seen.add(target);
          queue.push(target);
        }
      } else if (link.kind === "external") {
        note(externalFoundOn, link.url, path);
        if (new URL(link.url).hostname.toLowerCase().replace(/^www\./, "") === "github.com") githubLinks.push(href);
      } else if (link.kind === "mailto") {
        mailtos.add(href);
        const problem = mailtoProblem(link.address, link.query);
        if (problem !== null) fail(href, `mailto ${problem}`, [path]);
      } else {
        fail(href, link.reason, [path]);
      }
    }

    if (!unlistedHref && bodyPointsAtUnlistedRepository(response.body)) {
      fail(path, `the page's HTML ${NOT_ALLOWED}`, [path]);
    }

    if (writtenSlug !== null) {
      const repository = repositoryOf.get(writtenSlug);
      for (const href of githubLinks) {
        if (href !== repository) fail(href, `repository link is not this project's repository ${repository ?? "(none)"}`, [path]);
      }
      if (repository !== undefined && !hrefs.includes(repository)) {
        fail(path, `written project page does not link its repository ${repository}`, [path]);
      }
    }
  }

  const external: ExternalResult[] = await mapLimited([...externalFoundOn], CONCURRENCY, async ([url, foundOn]) => ({
    url,
    foundOn: [...foundOn],
    ...(await checkExternal(url, deps)),
  }));
  for (const result of external) {
    if (result.outcome === "failed") fail(result.url, result.detail, result.foundOn);
  }
  return { pages, external, mailto: mailtos.size, failures };
}

// ---------------------------------------------------------------- report

export function report(result: Result): string {
  const lines: string[] = ["Pages:"];
  for (const page of result.pages) {
    const ok = page.status === page.expected;
    lines.push(`  ${ok ? "pass" : "FAIL"}  ${page.status ?? "---"}  ${page.path}${page.expected === 404 ? "  (expected 404)" : ""}`);
  }
  lines.push("External links:");
  for (const link of result.external) {
    const mark = link.outcome === "ok" ? "pass" : link.outcome === "blocked" ? "skip" : "FAIL";
    lines.push(`  ${mark}  ${link.url}  ${link.detail}`);
  }
  if (result.failures.length > 0) {
    lines.push("Failures:");
    for (const failure of result.failures) {
      const where = failure.foundOn.length > 0 ? `; found on ${failure.foundOn.join(", ")}` : "";
      lines.push(`  ${failure.subject}: ${failure.detail}${where}`);
    }
  }
  const blocked = result.external.filter((link) => link.outcome === "blocked").length;
  const summary =
    `${result.pages.length} page(s), ${result.external.length} external link(s)` +
    (blocked > 0 ? ` (${blocked} not checked: blocked automated access)` : "") +
    ` and ${result.mailto} distinct mailto link(s) checked`;
  lines.push(result.failures.length === 0 ? `${summary}; every link works.` : `${summary}; ${result.failures.length} failure(s).`);
  return `${lines.join("\n")}\n`;
}

export async function main(argv: string[], deps: Deps & { out: (text: string) => void; err: (text: string) => void }): Promise<number> {
  const base = argv[0];
  if (base === undefined || argv.length !== 1) {
    deps.err("usage: node scripts/check-links.mts <base-url>");
    return 2;
  }
  try {
    const url = new URL(base);
    if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("not http(s)");
  } catch {
    deps.err(`check-links: ${base} is not an http(s) URL`);
    return 2;
  }
  const result = await checkLinks(base, deps);
  deps.out(report(result));
  return result.failures.length === 0 ? 0 : 1;
}

if (isEntryPoint(import.meta.url)) {
  main(process.argv.slice(2), {
    http: makeHttp(),
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    out: (text) => process.stdout.write(text),
    err: (text) => console.error(text),
  }).then(
    (code) => process.exit(code),
    (error: unknown) => {
      console.error(`check-links: ${errorText(error)}`);
      process.exit(1);
    },
  );
}
