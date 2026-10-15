// Tests for check-links.mts. Run with: npm run test:scripts
//
// The HTTP layer and sleep are fakes, so no test touches the network. One
// suite walks the I/O matrix in the story spec row by row.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, test } from "node:test";
import { fileURLToPath } from "node:url";

import {
  ALLOWED_REPOSITORIES,
  ATTEMPTS,
  BOT_BLOCK_EXEMPTION,
  CANONICAL_ORIGINS,
  CV_DOCUMENT,
  CV_WORDS,
  DOCUMENT_EXTENSIONS,
  DOCUMENT_HOSTS,
  OWNER_WORDS,
  CONCURRENCY,
  MAX_PAGES,
  EXPECTED_REPOSITORIES,
  NOT_FOUND_PAGES,
  USER_AGENT,
  checkExternal,
  checkLinks,
  NOT_ALLOWED,
  bodyPointsAtUnlistedRepository,
  classify,
  cvDocumentProblem,
  decodeEntities,
  expectedStatus,
  extractHrefs,
  isBotBlock,
  pointsAtUnlistedRepository,
  mailtoProblem,
  main,
  makeHttp,
  mapLimited,
  report,
  writtenProjectOf,
  type Deps,
  type Http,
  type HttpResponse,
} from "./check-links.mts";
import { projects } from "../content/projects/index.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BASE = "http://localhost:3000";
const LINKEDIN = "https://www.linkedin.com/in/shahrouz-mohaghegh/";
const PR1 = EXPECTED_REPOSITORIES["career-application-system"];
const PR2 = EXPECTED_REPOSITORIES["this-website"];
const PROJECTS = [
  { slug: "career-application-system", repository: PR1 },
  { slug: "this-website", repository: PR2 },
  { slug: "platform-modernisation" },
];

type Answer = HttpResponse | Error | Array<HttpResponse | Error>;
const page = (body: string, status = 200): HttpResponse => ({ status, body });
const links = (...hrefs: string[]): string => hrefs.map((href) => `<a href="${href}">x</a>`).join("");
const FOOTER = links("/", "/experience", "/projects", "/contact", "mailto:me@example.com", LINKEDIN);

// A site: one answer (or a sequence, one per call) per URL. Anything not
// listed answers 404. Every call is recorded.
function fakeSite(answers: Record<string, Answer>) {
  const calls: Array<{ url: string; follow: boolean }> = [];
  const counts = new Map<string, number>();
  const http: Http = async (url, { follow }) => {
    calls.push({ url, follow });
    const answer = answers[url];
    const n = counts.get(url) ?? 0;
    counts.set(url, n + 1);
    const one = Array.isArray(answer) ? answer[Math.min(n, answer.length - 1)] : answer;
    if (one === undefined) return page("", 404);
    if (one instanceof Error) throw one;
    // As makeHttp does: a followed (external) request drops the body.
    return follow ? { status: one.status, body: "" } : one;
  };
  return { http, calls };
}

// The site as it stands: every page good, both not-found pages 404, no
// project written, every external URL 200.
function goodSite(overrides: Record<string, Answer> = {}): Record<string, Answer> {
  return {
    [`${BASE}/`]: page(FOOTER + links("/experience/offshore-delivery-turnaround")),
    [`${BASE}/experience`]: page(FOOTER + links("/experience/offshore-delivery-turnaround")),
    [`${BASE}/experience/offshore-delivery-turnaround`]: page(FOOTER),
    [`${BASE}/projects`]: page(FOOTER + links("/projects/career-application-system", "/projects/platform-modernisation")),
    [`${BASE}/projects/career-application-system`]: page(FOOTER, 404),
    [`${BASE}/projects/platform-modernisation`]: page(FOOTER, 404),
    [`${BASE}/contact`]: page(FOOTER),
    [`${BASE}/case-study-not-available`]: page(FOOTER, 404),
    [`${BASE}/project-not-available`]: page(FOOTER, 404),
    [LINKEDIN]: page(""),
    [PR1]: page(""),
    [PR2]: page(""),
    ...overrides,
  };
}

function deps(answers: Record<string, Answer>, extra: Partial<Deps> = {}) {
  const site = fakeSite(answers);
  const sleeps: number[] = [];
  const d: Deps = {
    http: site.http,
    sleep: async (ms) => {
      sleeps.push(ms);
    },
    projects: PROJECTS,
    writtenProjects: [],
    ...extra,
  };
  return { deps: d, calls: site.calls, sleeps };
}

// ---------------------------------------------------------------- allowlist

// A made-up repository under the owner: every failing case uses it, so no
// test names a real repository off the allowlist.
const UNLISTED = "made-up-private-repo";
const OWNER = "shahrouzmohaghegh";

describe("pointsAtUnlistedRepository", () => {
  test("the public allowlist of repositories is exactly the two expected ones", () => {
    assert.deepEqual([...ALLOWED_REPOSITORIES], ["career-application-system", "shahrouz-portfolio"]);
    assert.deepEqual(
      Object.values(EXPECTED_REPOSITORIES).map((url) => url.split("/").pop()).sort(),
      [...ALLOWED_REPOSITORIES].sort(),
    );
  });

  const positives = [
    `https://github.com/${OWNER}/${UNLISTED}`,
    `https://github.com/${OWNER}/${UNLISTED}/`,
    `https://github.com/${OWNER}/${UNLISTED}.git`,
    `https://GitHub.com/ShahrouzMohaghegh/Made-Up-Private-Repo`,
    `http://github.com/${OWNER}/${UNLISTED}`,
    `http://www.github.com/${OWNER}/${UNLISTED}`,
    `github.com/${OWNER}/${UNLISTED}`,
    `git@github.com:${OWNER}/${UNLISTED}.git`,
    `ssh://git@github.com/${OWNER}/${UNLISTED}.git`,
    `ssh://git@github.com:22/${OWNER}/${UNLISTED}.git`,
    `https://github.com/${OWNER}/${UNLISTED}/blob/main/README.md`,
    `https://github.com/${OWNER}/${UNLISTED}?tab=readme`,
    `https://github.com/${OWNER}/${UNLISTED}#readme`,
    `https://github.com/${OWNER}/${UNLISTED}.git#main`,
    `https://github.com/${OWNER}%2F${UNLISTED}`,
    `https://github.com/${OWNER}%2f${UNLISTED}`,
    `https://github.com:443/${OWNER}/${UNLISTED}`,
    `https://api.github.com/repos/${OWNER}/${UNLISTED}`,
    `https://API.GitHub.com:443/repos/${OWNER}/${UNLISTED}/contents/README.md`,
    `https://raw.githubusercontent.com/${OWNER}/${UNLISTED}/main/README.md`,
    `https://raw.githubusercontent.com:443/${OWNER}/${UNLISTED}/refs/heads/main/x`,
    `see github.com/${OWNER}/${UNLISTED}.`,
    `https://github.com/${OWNER}/career-application-system-old`,
    `https://github.com/${OWNER}/career-application-system.github`,
    `https://github.com/${OWNER}/shahrouz-portfolio2`,
  ];
  for (const href of positives) test(`fails ${href}`, () => assert.equal(pointsAtUnlistedRepository(href), true));

  const negatives = [
    PR1,
    PR2,
    `${PR1}.git`,
    `${PR1}/tree/main`,
    `${PR2}/blob/main/README.md?plain=1#L1`,
    `https://GitHub.com/ShahrouzMohaghegh/Career-Application-System`,
    `git@github.com:${OWNER}/shahrouz-portfolio.git`,
    `https://github.com:443/${OWNER}/career-application-system`,
    `https://api.github.com/repos/${OWNER}/career-application-system`,
    `https://raw.githubusercontent.com/${OWNER}/shahrouz-portfolio/main/README.md`,
    `https://github.com/${OWNER}%2Fshahrouz-portfolio`,
    `see ${PR2}.`,
    `https://github.com/${OWNER}`,
    `https://github.com/${OWNER}/`,
    `https://github.com/${OWNER}?tab=repositories`,
    `https://github.com/someone-else/${UNLISTED}`,
    "/projects/career-application-system",
  ];
  for (const href of negatives) test(`allows ${href}`, () => assert.equal(pointsAtUnlistedRepository(href), false));
});

describe("bodyPointsAtUnlistedRepository", () => {
  test("finds an unlisted repository anywhere in the HTML, scripts included", () => {
    assert.equal(bodyPointsAtUnlistedRepository(`<script>self.__next_f.push([1,"https://github.com/${OWNER}/${UNLISTED}"])</script>`), true);
    assert.equal(bodyPointsAtUnlistedRepository(`<p>github.com/${OWNER}/${UNLISTED}</p>`), true);
  });
  test("through entities, JSON-escaped and percent-encoded slashes", () => {
    assert.equal(bodyPointsAtUnlistedRepository(`<p>github.com&#x2F;${OWNER}&#47;${UNLISTED}</p>`), true);
    assert.equal(bodyPointsAtUnlistedRepository(`<script>"https:\\/\\/github.com\\/${OWNER}\\/${UNLISTED}"</script>`), true);
    assert.equal(bodyPointsAtUnlistedRepository(`<script>"github.com\\u002F${OWNER}\\u002f${UNLISTED}"</script>`), true);
    assert.equal(bodyPointsAtUnlistedRepository(`<p>github.com/${OWNER}%2F${UNLISTED} and 100%</p>`), true);
  });
  test("not the allowed repositories or the profile root", () => {
    assert.equal(bodyPointsAtUnlistedRepository(`<script>"${PR1}" "${PR2}"</script>`), false);
    assert.equal(bodyPointsAtUnlistedRepository(`<script>"github.com\\/${OWNER}\\/career-application-system"</script>`), false);
    assert.equal(bodyPointsAtUnlistedRepository(`<a href="https://github.com/${OWNER}">GitHub</a>`), false);
  });
});

// ---------------------------------------------------------------- extraction

describe("decodeEntities", () => {
  test("decodes any numeric entity, decimal or hex in any case", () => {
    assert.equal(decodeEntities("&#47;&#x2F;&#x2f;&#X2F;&#0047;&#x00003A;"), "/////:");
    assert.equal(decodeEntities("&#103;&#x69;&#X74;&#104;ub"), "github");
  });
  test("decodes the named set and leaves unknown or invalid ones", () => {
    assert.equal(decodeEntities("a&amp;b&lt;&gt;&quot;&apos;&sol;"), `a&b<>"'/`);
    assert.equal(decodeEntities("&nosuch; &#x110000; &#xZZ;"), "&nosuch; &#x110000; &#xZZ;");
  });
  test("a numerically encoded link to an unlisted repository is caught", () => {
    const href = extractHrefs(`<a href="https:&#x2F;&#X2f;github.com&#47;${OWNER}&#x2F;${UNLISTED}">x</a>`)[0];
    assert.equal(pointsAtUnlistedRepository(href), true);
  });
});

describe("extractHrefs", () => {
  test("reads a and area hrefs in any quoting, entity-decoded, in order", () => {
    const html = `<a class="x" href="/one">1</a><A HREF='/two?a=1&amp;b=2'>2</A><area href=/three><a id="no-href">n</a>`;
    assert.deepEqual(extractHrefs(html), ["/one", "/two?a=1&b=2", "/three"]);
  });

  test("skips link, script and comment content", () => {
    const html = `<link rel="stylesheet" href="/s.css"><script>var a = '<a href="/in-script">';</script><!-- <a href="/commented"> --><a href="/real">r</a>`;
    assert.deepEqual(extractHrefs(html), ["/real"]);
  });
});

describe("classify", () => {
  const at = `${BASE}/projects`;
  test("same origin is internal, fragment stripped, query kept", () => {
    assert.deepEqual(classify("/experience#top", at, BASE), { kind: "internal", path: "/experience" });
    assert.deepEqual(classify("#main", at, BASE), { kind: "internal", path: "/projects" });
    assert.deepEqual(classify(`${BASE}/contact?x=1`, at, BASE), { kind: "internal", path: "/contact" });
    assert.deepEqual(classify("this-website", `${BASE}/projects/`, BASE), { kind: "internal", path: "/projects/this-website" });
  });
  test("the canonical origins are internal, mapped onto the base URL's paths", () => {
    assert.deepEqual([...CANONICAL_ORIGINS], ["https://shahrouzmohaghegh.com", "https://www.shahrouzmohaghegh.com"]);
    assert.deepEqual(classify("https://shahrouzmohaghegh.com/contact?x=1#y", at, BASE), { kind: "internal", path: "/contact" });
    assert.deepEqual(classify("https://www.shahrouzmohaghegh.com/", at, BASE), { kind: "internal", path: "/" });
    assert.equal(classify("https://shahrouzmohaghegh.com.example.org/", at, BASE).kind, "external");
  });
  test("another origin is external, fragment stripped", () => {
    assert.deepEqual(classify(`${PR1}#readme`, at, BASE), { kind: "external", url: PR1 });
    assert.deepEqual(classify("http://localhost:4000/", at, BASE), { kind: "external", url: "http://localhost:4000/" });
  });
  test("mailto splits address and query", () => {
    assert.deepEqual(classify("mailto:a@b.co?subject=hi", at, BASE), { kind: "mailto", address: "a@b.co", query: "subject=hi" });
  });
  test("other schemes are other", () => {
    assert.equal(classify("tel:+61", at, BASE).kind, "other");
    assert.equal(classify("javascript:void(0)", at, BASE).kind, "other");
  });
});

describe("mailtoProblem", () => {
  test("one address and no query passes", () => assert.equal(mailtoProblem("me@example.com", ""), null));
  test("a query fails", () => assert.match(mailtoProblem("me@example.com", "subject=x") ?? "", /query/));
  test("two addresses fail", () => assert.match(mailtoProblem("a@b.co,c@d.co", "") ?? "", /one address/));
  test("no address fails", () => assert.match(mailtoProblem("", "") ?? "", /one address/));
  test("not an address fails", () => assert.match(mailtoProblem("someone", "") ?? "", /one address/));
});

describe("expectedStatus", () => {
  test("the two not-found pages answer 404", () => {
    for (const path of NOT_FOUND_PAGES) assert.equal(expectedStatus(path), 404);
  });
  test("a written case study answers 200, an unwritten slug 404", () => {
    assert.equal(expectedStatus("/experience/offshore-delivery-turnaround"), 200);
    assert.equal(expectedStatus("/experience/no-such-case-study"), 404);
  });
  test("an unwritten project answers 404, a written one 200", () => {
    assert.equal(expectedStatus("/projects/no-such-project"), 404);
    const routes = [{ prefix: "/projects/", written: ["this-website"] }];
    assert.equal(expectedStatus("/projects/this-website", routes), 200);
    assert.equal(expectedStatus("/projects/other", routes), 404);
  });
  test("listings and other pages answer 200", () => {
    for (const path of ["/", "/experience", "/projects", "/contact", "/experience/"]) assert.equal(expectedStatus(path), 200);
  });
  test("the not-found pages match lib/not-found-rewrite.ts", () => {
    const source = readFileSync(join(ROOT, "lib/not-found-rewrite.ts"), "utf8");
    const declared = [...source.matchAll(/"(\/[a-z-]+-not-available)"/g)].map((m) => m[1]);
    assert.deepEqual([...new Set(declared)].sort(), [...NOT_FOUND_PAGES].sort());
  });
});

describe("writtenProjectOf", () => {
  test("only a written project's page", () => {
    assert.equal(writtenProjectOf("/projects/this-website", ["this-website"]), "this-website");
    assert.equal(writtenProjectOf("/projects/this-website", []), null);
    assert.equal(writtenProjectOf("/projects", ["this-website"]), null);
  });
});

// ---------------------------------------------------------------- external

describe("checkExternal", () => {
  test("200 first time: one attempt", async () => {
    const { deps: d, calls } = deps({ [PR1]: page("") });
    assert.deepEqual(await checkExternal(PR1, d), { outcome: "ok", detail: "HTTP 200" });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].follow, true);
  });

  test("a failure then 200 passes after a backoff", async () => {
    const { deps: d, sleeps } = deps({ [PR1]: [page("", 503), page("")] });
    assert.equal((await checkExternal(PR1, d)).outcome, "ok");
    assert.equal(sleeps.length, 1);
  });

  test("retries twice, so three attempts, before failing", async () => {
    const { deps: d, calls, sleeps } = deps({ [PR1]: page("", 500) });
    const result = await checkExternal(PR1, d);
    assert.equal(result.outcome, "failed");
    assert.match(result.detail, /HTTP 500/);
    assert.equal(ATTEMPTS, 3);
    assert.equal(calls.length, 3);
    assert.equal(sleeps.length, 2);
  });

  test("the bot-block exemption is LinkedIn's www host with 999 or 429 only", () => {
    assert.deepEqual(BOT_BLOCK_EXEMPTION, { host: "www.linkedin.com", statuses: [999, 429] });
    assert.equal(isBotBlock(LINKEDIN, [999]), true);
    assert.equal(isBotBlock(LINKEDIN, [429, 999]), true);
    assert.equal(isBotBlock(LINKEDIN, [404]), false);
    assert.equal(isBotBlock(LINKEDIN, [999, 404]), false);
    assert.equal(isBotBlock(LINKEDIN, []), false);
    assert.equal(isBotBlock("https://linkedin.com/in/x", [999]), false);
    assert.equal(isBotBlock("https://www.linkedin.com.evil.example/in/x", [999]), false);
    assert.equal(isBotBlock(PR1, [999]), false);
    assert.equal(isBotBlock(PR1, [429]), false);
  });

  test("LinkedIn 404, 404, 999 fails: every HTTP answer must be a bot block", async () => {
    const { deps: d } = deps({ [LINKEDIN]: [page("", 404), page("", 404), page("", 999)] });
    const result = await checkExternal(LINKEDIN, d);
    assert.equal(result.outcome, "failed");
  });

  test("LinkedIn 999, network error, 999 is blocked", async () => {
    const { deps: d } = deps({ [LINKEDIN]: [page("", 999), new Error("socket hang up"), page("", 999)] });
    assert.equal((await checkExternal(LINKEDIN, d)).outcome, "blocked");
  });

  test("LinkedIn 999, 999, 999 is blocked", async () => {
    const { deps: d } = deps({ [LINKEDIN]: [page("", 999), page("", 999), page("", 999)] });
    assert.equal((await checkExternal(LINKEDIN, d)).outcome, "blocked");
  });

  test("LinkedIn erroring on every attempt fails", async () => {
    const { deps: d } = deps({ [LINKEDIN]: new Error("socket hang up") });
    assert.equal((await checkExternal(LINKEDIN, d)).outcome, "failed");
  });
});

describe("mapLimited", () => {
  test("runs at most the limit at once and keeps item order", async () => {
    let running = 0;
    let peak = 0;
    const out = await mapLimited([1, 2, 3, 4, 5, 6, 7, 8, 9], 4, async (n) => {
      running++;
      peak = Math.max(peak, running);
      await new Promise((resolve) => setTimeout(resolve, 2));
      running--;
      return n * 2;
    });
    assert.deepEqual(out, [2, 4, 6, 8, 10, 12, 14, 16, 18]);
    assert.equal(peak, 4);
  });

  test("checkLinks fetches external URLs at most CONCURRENCY at once", async () => {
    assert.equal(CONCURRENCY, 4);
    const many = Array.from({ length: 10 }, (_, i) => `https://example.org/${i}`);
    const answers = goodSite({ [`${BASE}/contact`]: page(FOOTER + links(...many)) });
    let running = 0;
    let peak = 0;
    const site = fakeSite(answers);
    const http: Http = async (url, options) => {
      if (!options.follow) return site.http(url, options);
      running++;
      peak = Math.max(peak, running);
      await new Promise((resolve) => setTimeout(resolve, 2));
      running--;
      return page("");
    };
    const result = await checkLinks(BASE, { http, sleep: async () => {}, projects: PROJECTS, writtenProjects: [] });
    assert.deepEqual(result.failures, []);
    assert.equal(peak, CONCURRENCY);
  });
});

describe("makeHttp", () => {
  test("sends the User-Agent, a timeout, and follows redirects only for external links", async () => {
    const seen: Array<{ url: string; init: RequestInit }> = [];
    const http = makeHttp(async (url, init) => {
      seen.push({ url, init });
      return new Response("<a href='/'>x</a>", { status: 200 });
    });
    assert.deepEqual(await http(PR1, { follow: true }), { status: 200, body: "" });
    assert.deepEqual(await http(`${BASE}/`, { follow: false }), { status: 200, body: "<a href='/'>x</a>" });
    assert.equal(seen[0].init.redirect, "follow");
    assert.equal(seen[1].init.redirect, "manual");
    assert.equal((seen[0].init.headers as Record<string, string>)["User-Agent"], USER_AGENT);
    assert.match(USER_AGENT, /shahrouzmohaghegh\.com/);
    assert.ok(seen[0].init.signal instanceof AbortSignal);
  });
});

// ---------------------------------------------------------------- matrix

describe("I/O matrix", () => {
  test("all good: exit 0, a summary of pages and links checked", async () => {
    const { deps: d, calls } = deps(goodSite());
    const result = await checkLinks(BASE, d);
    assert.deepEqual(result.failures, []);
    const paths = result.pages.map((p) => p.path).sort();
    assert.deepEqual(paths, [
      "/",
      "/case-study-not-available",
      "/contact",
      "/experience",
      "/experience/offshore-delivery-turnaround",
      "/project-not-available",
      "/projects",
      "/projects/career-application-system",
      "/projects/platform-modernisation",
    ]);
    assert.deepEqual(result.external.map((e) => e.url).sort(), [PR1, PR2, LINKEDIN].sort());
    assert.equal(calls.filter((c) => c.url === `${BASE}/`).length, 1, "each page fetched once");
    const internal = calls.filter((c) => c.url.startsWith(`${BASE}/`));
    assert.equal(internal.length, 9);
    assert.ok(internal.every((c) => c.follow === false), "internal pages are fetched without following redirects");
    assert.ok(calls.filter((c) => !c.url.startsWith(`${BASE}/`)).every((c) => c.follow === true));
    const text = report(result);
    assert.match(text, /9 page\(s\), 3 external link\(s\) and 1 distinct mailto link\(s\) checked; every link works\./);
  });

  test("the repositories are checked from the content model while no project is written", async () => {
    const { deps: d, calls } = deps(goodSite());
    const result = await checkLinks(BASE, d);
    for (const url of [PR1, PR2]) {
      assert.ok(calls.some((c) => c.url === url), `${url} fetched`);
      assert.deepEqual(result.external.find((e) => e.url === url)?.foundOn, ["content/projects/index.ts"]);
    }
  });

  test("broken external: names the URL, status and the page it was found on", async () => {
    for (const status of [404, 500]) {
      const broken = "https://example.org/gone";
      const { deps: d } = deps(goodSite({ [`${BASE}/contact`]: page(FOOTER + links(broken)), [broken]: page("", status) }));
      const result = await checkLinks(BASE, d);
      assert.equal(result.failures.length, 1);
      assert.deepEqual(result.failures[0].subject, broken);
      assert.match(result.failures[0].detail, new RegExp(`HTTP ${status}`));
      assert.deepEqual(result.failures[0].foundOn, ["/contact"]);
      assert.match(report(result), new RegExp(`${broken}: HTTP ${status}.*found on /contact`));
    }
  });

  test("unlisted repository linked in any form: names the page, never the repository, never fetched", async () => {
    for (const href of [
      `https://github.com/${OWNER}/${UNLISTED}`,
      `https://GITHUB.com/${OWNER}/${UNLISTED}.git`,
      `https://github.com/${OWNER}/${UNLISTED}/tree/main?x=1#y`,
      `https://api.github.com/repos/${OWNER}/${UNLISTED}`,
      `https://raw.githubusercontent.com/${OWNER}/${UNLISTED}/main/x`,
    ]) {
      const { deps: d, calls } = deps(goodSite({ [`${BASE}/contact`]: page(FOOTER + links(href)) }));
      const result = await checkLinks(BASE, d);
      assert.equal(result.failures.length, 1);
      assert.equal(result.failures[0].detail, NOT_ALLOWED);
      assert.equal(NOT_ALLOWED, "points at a repository that is not on the public allowlist");
      assert.deepEqual(result.failures[0].foundOn, ["/contact"]);
      assert.ok(!calls.some((c) => c.url.toLowerCase().includes(UNLISTED)));
      const text = report(result);
      assert.match(text, /points at a repository that is not on the public allowlist; found on \/contact/);
      assert.ok(!text.toLowerCase().includes(UNLISTED), "the report never names the repository");
    }
  });

  test("an unlisted repository anywhere in a page's HTML fails, naming the page only", async () => {
    const script = `<script>self.__next_f.push([1,"https:\\/\\/github.com\\/${OWNER}\\/${UNLISTED}"])</script>`;
    const { deps: d } = deps(goodSite({ [`${BASE}/contact`]: page(FOOTER + script) }));
    const result = await checkLinks(BASE, d);
    assert.equal(result.failures.length, 1);
    assert.equal(result.failures[0].subject, "/contact");
    assert.match(result.failures[0].detail, /points at a repository that is not on the public allowlist/);
    assert.ok(!report(result).toLowerCase().includes(UNLISTED));
  });

  test("an unlisted repository in the content model fails without naming it", async () => {
    const { deps: d, calls } = deps(goodSite(), {
      projects: [...PROJECTS, { slug: "leak", repository: `https://github.com/${OWNER}/${UNLISTED}` }],
    });
    const result = await checkLinks(BASE, d);
    assert.deepEqual(result.failures.map((f) => [f.subject, f.detail]), [["project leak", `repository ${NOT_ALLOWED}`]]);
    assert.ok(!report(result).toLowerCase().includes(UNLISTED));
    assert.ok(!calls.some((c) => c.url.toLowerCase().includes(UNLISTED)));
  });

  test("an expected project pointing at an unlisted repository fails without naming it", async () => {
    const { deps: d } = deps(goodSite(), {
      projects: [{ slug: "career-application-system", repository: `https://github.com/${OWNER}/${UNLISTED}` }, PROJECTS[1]],
    });
    const result = await checkLinks(BASE, d);
    assert.deepEqual(result.failures.map((f) => f.subject), ["project career-application-system"]);
    assert.ok(!report(result).toLowerCase().includes(UNLISTED));
  });

  test("allowed repositories and the profile root pass", async () => {
    const { deps: d } = deps(goodSite({
      [`${BASE}/contact`]: page(FOOTER + links(PR1, `https://github.com/${OWNER}`)),
      [`https://github.com/${OWNER}`]: page(""),
    }));
    const result = await checkLinks(BASE, d);
    assert.deepEqual(result.failures, []);
    assert.deepEqual(result.external.find((e) => e.url === PR1)?.foundOn.sort(), ["/contact", "content/projects/index.ts"]);
  });

  test("LinkedIn bot block: 999 or 429 after retries is reported as not checked, no failure", async () => {
    for (const status of [999, 429]) {
      const { deps: d, calls } = deps(goodSite({ [LINKEDIN]: page("", status) }));
      const result = await checkLinks(BASE, d);
      assert.deepEqual(result.failures, []);
      assert.equal(calls.filter((c) => c.url === LINKEDIN).length, ATTEMPTS);
      const linkedin = result.external.find((e) => e.url === LINKEDIN);
      assert.equal(linkedin?.outcome, "blocked");
      assert.match(report(result), /skip {2}https:\/\/www\.linkedin\.com\/in\/shahrouz-mohaghegh\/ {2}HTTP \d+: blocked automated access, not checked/);
      assert.match(report(result), /1 not checked: blocked automated access/);
    }
  });

  test("a 999 from any other host fails", async () => {
    const { deps: d } = deps(goodSite({ [PR2]: page("", 999) }));
    const result = await checkLinks(BASE, d);
    assert.equal(result.failures.length, 1);
    assert.equal(result.failures[0].subject, PR2);
  });

  test("LinkedIn 404 fails", async () => {
    const { deps: d } = deps(goodSite({ [LINKEDIN]: page("", 404) }));
    const result = await checkLinks(BASE, d);
    assert.equal(result.failures.length, 1);
    assert.equal(result.failures[0].subject, LINKEDIN);
    assert.match(result.failures[0].detail, /HTTP 404/);
  });

  test("internal 404: a linked page that is not an expected not-found fails", async () => {
    const { deps: d } = deps(goodSite({ [`${BASE}/contact`]: page("", 404) }));
    const result = await checkLinks(BASE, d);
    assert.equal(result.failures.length, 1);
    assert.equal(result.failures[0].subject, "/contact");
    assert.match(result.failures[0].detail, /HTTP 404, expected 200/);
    assert.ok(result.failures[0].foundOn.includes("/"));
  });

  test("an expected not-found page answering 200 fails", async () => {
    const { deps: d } = deps(goodSite({ [`${BASE}/project-not-available`]: page(FOOTER) }));
    const result = await checkLinks(BASE, d);
    assert.deepEqual(result.failures.map((f) => f.subject), ["/project-not-available"]);
  });

  test("a written project page answering 404 fails", async () => {
    const { deps: d } = deps(goodSite(), { writtenProjects: ["career-application-system"] });
    const result = await checkLinks(BASE, d);
    assert.ok(result.failures.some((f) => f.subject === "/projects/career-application-system" && /HTTP 404, expected 200/.test(f.detail)));
  });

  test("an internal redirect fails", async () => {
    const { deps: d } = deps(goodSite({ [`${BASE}/contact`]: page("", 308) }));
    const result = await checkLinks(BASE, d);
    assert.deepEqual(result.failures.map((f) => f.subject), ["/contact"]);
  });

  test("network error: fetch throws on every attempt, naming the URL and the error", async () => {
    const { deps: d } = deps(goodSite({ [PR2]: new Error("getaddrinfo ENOTFOUND github.com") }));
    const result = await checkLinks(BASE, d);
    assert.equal(result.failures.length, 1);
    assert.equal(result.failures[0].subject, PR2);
    assert.match(result.failures[0].detail, /ENOTFOUND github\.com/);
  });

  test("a bad mailto fails", async () => {
    const { deps: d } = deps(goodSite({ [`${BASE}/contact`]: page(FOOTER + links("mailto:me@example.com?subject=hello")) }));
    const result = await checkLinks(BASE, d);
    assert.equal(result.failures.length, 1);
    assert.match(result.failures[0].detail, /query/);
  });
});

// ---------------------------------------------------------------- CV documents (FR-23)

describe("cvDocumentProblem", () => {
  test("the rule is the five document extensions, the two words, the owner's names and the document hosts", () => {
    assert.deepEqual([...DOCUMENT_EXTENSIONS], ["pdf", "doc", "docx", "rtf", "odt"]);
    assert.deepEqual([...CV_WORDS], ["cv", "resume"]);
    assert.deepEqual([...OWNER_WORDS], ["shahrouz", "mohaghegh"]);
    assert.deepEqual(
      DOCUMENT_HOSTS.map((h) => h.host),
      ["docs.google.com", "drive.google.com", "dropbox.com", "dropboxusercontent.com"],
    );
  });

  const positives: Array<[string, string]> = [
    // cv or resume as a word, any host, path or query value
    ["/cv", "the word cv"],
    ["/CV/", "the word in capitals"],
    ["/downloads/cv-2026", "cv between separators"],
    ["/shahrouz_cv", "cv after an underscore"],
    ["/resume", "the word resume"],
    ["/my-resume.html", "resume in a filename"],
    ["/r%C3%A9sum%C3%A9", "résumé percent-encoded"],
    ["/résumé", "résumé with accents"],
    ["https://shahrouzmohaghegh.com/cv", "the canonical origin"],
    ["https://example.org/people/cv", "cv on another host"],
    ["/?file=cv.pdf", "cv in a query value"],
    ["/download?id=resume", "resume as a query value"],
    ["https://example.org/get?name=Resume%20final", "resume encoded in a query value"],
    // a document extension on this site
    ["/files/profile.pdf", "a same-origin pdf"],
    ["/shahrouz.PDF", "a same-origin PDF in capitals"],
    ["/x.rtf#page=2", "a same-origin rtf with a fragment"],
    ["/x.odt", "a same-origin odt"],
    ["/x.pdf/", "a trailing slash"],
    ["/x.pdf.", "a trailing dot"],
    ["/x.pdf%20", "a trailing encoded space"],
    ["/x.pdf ", "a trailing space"],
    ["/x.pdf;v=1", "a ;parameter"],
    ["/x%2Epdf", "an encoded dot"],
    ["/?f=profile.docx", "a same-origin docx in a query value"],
    ["https://www.shahrouzmohaghegh.com/a.doc", "a doc on the www canonical origin"],
    // a document extension elsewhere that names the owner
    ["https://example.org/files/shahrouz-mohaghegh.pdf", "the owner's name in a cross-site pdf"],
    ["https://cdn.example.org/Mohaghegh_2026.docx", "the surname in a cross-site docx"],
    ["https://example.org/get?f=shahrouz.pdf", "the owner's name in a cross-site query value"],
    // document hosts
    ["https://docs.google.com/document/d/abc/edit", "a Google Docs document"],
    ["https://drive.google.com/file/d/abc/view", "Google Drive"],
    ["https://www.dropbox.com/s/abc/file", "Dropbox"],
    ["https://dl.dropboxusercontent.com/s/abc", "Dropbox content"],
  ];
  for (const [href, why] of positives) test(`fails ${href} (${why})`, () => assert.equal(cvDocumentProblem(href, BASE), CV_DOCUMENT));

  const negatives = [
    "/",
    "/contact",
    "/experience/offshore-delivery-turnaround",
    "/projects/career-application-system",
    LINKEDIN,
    PR1,
    PR2,
    `${PR2}/blob/main/README.md`,
    "mailto:me@example.com",
    "mailto:cv@example.com",
    "/cvs-are-written-per-job",
    "/curve",
    "/resumes-later",
    "/pdf-guide",
    "/docs/intro",
    "/#cv",
    "https://example.org/papers/attention.pdf",
    "https://www.rfc-editor.org/rfc/rfc9110.pdf",
    "https://example.org/standard.docx?lang=en",
    "https://docs.google.com/spreadsheets/d/abc",
  ];
  for (const href of negatives) test(`allows ${href}`, () => assert.equal(cvDocumentProblem(href, BASE), null));

  test("relative links resolve against the given origin, so a same-origin pdf there fails", () => {
    assert.equal(cvDocumentProblem("http://localhost:3000/a.pdf", BASE), CV_DOCUMENT);
    assert.equal(cvDocumentProblem("http://localhost:3000/a.pdf", "http://other.test"), null);
  });
});

describe("CV document links", () => {
  test("a CV document link on any page fails, names the page, and is never fetched", async () => {
    for (const href of ["/cv.pdf", "https://example.org/resume", "/files/shahrouz-cv.docx", "/files/profile.pdf", "https://drive.google.com/file/d/x"]) {
      const { deps: d, calls } = deps(goodSite({ [`${BASE}/contact`]: page(FOOTER + links(href)) }));
      const result = await checkLinks(BASE, d);
      assert.equal(result.failures.length, 1, href);
      assert.equal(result.failures[0].subject, href);
      assert.equal(result.failures[0].detail, CV_DOCUMENT);
      assert.deepEqual(result.failures[0].foundOn, ["/contact"]);
      assert.ok(!calls.some((c) => c.url.endsWith(href.replace(/^\//, ""))), `${href} not fetched`);
    }
  });

  test("a cross-site paper PDF is not a CV document link", async () => {
    const paper = "https://example.org/papers/attention.pdf";
    const { deps: d } = deps(goodSite({ [`${BASE}/contact`]: page(FOOTER + links(paper)), [paper]: page("") }));
    const result = await checkLinks(BASE, d);
    assert.deepEqual(result.failures, []);
  });

  test("main exits 1 on a CV document link", async () => {
    const { deps: d } = deps(goodSite({ [`${BASE}/`]: page(FOOTER + links("/cv")) }));
    const out: string[] = [];
    const code = await main([BASE], { ...d, out: (t) => out.push(t), err: () => {} });
    assert.equal(code, 1);
    assert.match(out.join(""), /\/cv: links to a CV/);
  });
});

describe("crawl", () => {
  test("query strings are dropped, so a page is fetched once", async () => {
    const { deps: d, calls } = deps(goodSite({ [`${BASE}/`]: page(FOOTER + links("/contact?a=1", "/contact?b=2", "/contact#x")) }));
    const result = await checkLinks(BASE, d);
    assert.deepEqual(result.failures, []);
    assert.deepEqual(calls.filter((c) => c.url.includes("/contact")).map((c) => c.url), [`${BASE}/contact`]);
  });

  test("a canonical-origin link is crawled against the base URL, not production", async () => {
    const { deps: d, calls } = deps(goodSite({ [`${BASE}/`]: page(FOOTER + links("https://shahrouzmohaghegh.com/contact", "https://www.shahrouzmohaghegh.com/")) }));
    const result = await checkLinks(BASE, d);
    assert.deepEqual(result.failures, []);
    assert.ok(!calls.some((c) => c.url.includes("shahrouzmohaghegh.com/")));
    assert.ok(!result.external.some((e) => e.url.includes("shahrouzmohaghegh.com")));
  });

  test("past MAX_PAGES pages the crawl fails clearly", async () => {
    assert.equal(MAX_PAGES, 200);
    const http: Http = async (url) => {
      const n = Number(new URL(url).pathname.split("/").pop()) || 0;
      return page(links(`/loop/${n + 1}`), url.endsWith("-not-available") ? 404 : 200);
    };
    const result = await checkLinks(BASE, { http, sleep: async () => {}, projects: PROJECTS, writtenProjects: [], maxPages: 5 });
    assert.equal(result.pages.length, 5);
    const crawl = result.failures.find((f) => f.subject === "crawl");
    assert.match(crawl?.detail ?? "", /stopped after 5 pages/);
    const full = await checkLinks(BASE, { http, sleep: async () => {}, projects: PROJECTS, writtenProjects: [] });
    assert.equal(full.pages.length, MAX_PAGES);
    assert.ok(full.failures.some((f) => f.subject === "crawl"));
  });

  test("distinct mailto hrefs are counted once", async () => {
    const { deps: d } = deps(goodSite({ [`${BASE}/contact`]: page(FOOTER + links("mailto:other@example.com")) }));
    assert.equal((await checkLinks(BASE, d)).mailto, 2);
  });
});

describe("repository links", () => {
  test("the content model carries exactly the expected repositories", () => {
    const actual = Object.fromEntries(projects.filter((p) => p.repository !== undefined).map((p) => [p.slug, p.repository]));
    assert.deepEqual(actual, EXPECTED_REPOSITORIES);
    assert.equal(PR1, "https://github.com/shahrouzmohaghegh/career-application-system");
    assert.equal(PR2, "https://github.com/shahrouzmohaghegh/shahrouz-portfolio");
  });

  test("a wrong repository in the model fails", async () => {
    const { deps: d } = deps(goodSite(), { projects: [{ slug: "career-application-system", repository: PR1 }, { slug: "this-website", repository: `${PR2}-old` }] });
    const result = await checkLinks(BASE, d);
    assert.ok(result.failures.some((f) => f.subject === "project this-website"));
  });

  const writtenSite = (body: string) =>
    goodSite({ [`${BASE}/projects/career-application-system`]: page(FOOTER + body) });

  test("a written project page linking its repository exactly passes", async () => {
    const { deps: d } = deps(writtenSite(links(PR1, PR1)), { writtenProjects: ["career-application-system"] });
    assert.deepEqual((await checkLinks(BASE, d)).failures, []);
  });

  test("a written project page linking another repository fails", async () => {
    const { deps: d } = deps(writtenSite(links(PR1, PR2)), { writtenProjects: ["career-application-system"] });
    const result = await checkLinks(BASE, d);
    assert.deepEqual(result.failures.map((f) => f.subject), [PR2]);
  });

  test("a written project page linking its repository in another form fails", async () => {
    const { deps: d } = deps({ ...writtenSite(links(PR1, `${PR1}/`)), [`${PR1}/`]: page("") }, { writtenProjects: ["career-application-system"] });
    const result = await checkLinks(BASE, d);
    assert.deepEqual(result.failures.map((f) => f.subject), [`${PR1}/`]);
  });

  test("a written project page without its repository link fails", async () => {
    const { deps: d } = deps(writtenSite(""), { writtenProjects: ["career-application-system"] });
    const result = await checkLinks(BASE, d);
    assert.ok(result.failures.some((f) => /does not link its repository/.test(f.detail)));
  });
});

describe("main", () => {
  const io = () => {
    const out: string[] = [];
    const err: string[] = [];
    return { out, err, sinks: { out: (t: string) => out.push(t), err: (t: string) => err.push(t) } };
  };

  test("exit 0 when every link works", async () => {
    const { deps: d } = deps(goodSite());
    const { out, sinks } = io();
    assert.equal(await main([BASE], { ...d, ...sinks }), 0);
    assert.match(out.join(""), /every link works/);
  });

  test("exit 1 naming each failure", async () => {
    const { deps: d } = deps(goodSite({ [LINKEDIN]: page("", 404) }));
    const { out, sinks } = io();
    assert.equal(await main([BASE], { ...d, ...sinks }), 1);
    assert.match(out.join(""), /Failures:\n {2}https:\/\/www\.linkedin\.com\/in\/shahrouz-mohaghegh\/: HTTP 404 after 3 attempts, not 200; found on /);
  });

  test("a missing or bad base URL is a usage error", async () => {
    const { deps: d } = deps(goodSite());
    for (const argv of [[], ["ftp://x"], ["nonsense"], [BASE, "extra"]]) {
      const { err, sinks } = io();
      assert.equal(await main(argv, { ...d, ...sinks }), 2);
      assert.ok(err.length > 0);
    }
  });
});
