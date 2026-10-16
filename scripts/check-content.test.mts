// Tests for check-content.mts. Run with: npm run test:scripts
//
// Every conditional rule is tested both ways: the condition that must fail
// and the exemption that must pass. The confidential terms are never named
// here: the term tests use invented fixture words, and the real list is read
// from .forbidden-terms only when the script runs. The HTTP layer is a fake.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import type { Http, HttpResponse } from "./check-links.mts";
import {
  EXEMPT_PHRASES,
  MAX_HEADCOUNT,
  RULES,
  TERMS_FILE,
  TermsError,
  canonicalRoutes,
  checkContent,
  headcountProblem,
  main,
  metaDescription,
  numberValue,
  pageProblems,
  pageTitle,
  parseTerms,
  qualifierProblems,
  readablePage,
  restOfSentence,
  robotsProblems,
  ruleHits,
  sitemapPaths,
  termHits,
  withoutExemptions,
  type Metric,
  type Term,
} from "./check-content.mts";

// Invented words standing in for confidential terms.
const FIXTURE_TERMS: Term[] = [
  { line: 3, pattern: /\bzorbia\b/i },
  { line: 4, pattern: /\bquillfeather\b/i },
];
const FIXTURE_EXEMPTIONS = ["National University of Zorbia"];

const html = (body: string, head = "<title>A page | Site</title><meta name=\"description\" content=\"About the page.\"/>"): string =>
  `<!DOCTYPE html><html><head>${head}</head><body>${body}</body></html>`;

describe("parseTerms", () => {
  test("reads one case-insensitive pattern per line, skipping blanks and comments, keeping line numbers", () => {
    const terms = parseTerms("# comment\n\nzorbia\n  quillfeather  \n");
    assert.deepEqual(
      terms.map((term) => term.line),
      [3, 4],
    );
    assert.ok(terms[0].pattern.test("ZORBIA"));
  });

  test("fails closed when the file is missing or holds no terms", () => {
    assert.throws(() => parseTerms(null), (error: Error) => error instanceof TermsError && error.message.includes("missing"));
    assert.throws(() => parseTerms("# only a comment\n"), (error: Error) => error instanceof TermsError && error.message.includes("holds no terms"));
  });

  test("an invalid pattern is reported by line number, never quoted", () => {
    assert.throws(
      () => parseTerms("zorbia\n(quill[\n"),
      (error: Error) => error.message === `${TERMS_FILE} line 2 is not a valid pattern` && !error.message.includes("quill"),
    );
  });
});

describe("the terms rule and its exemption", () => {
  test("condition: a bare term fails, in any case", () => {
    assert.deepEqual(termHits("She studied in Zorbia.", FIXTURE_TERMS, FIXTURE_EXEMPTIONS), [3]);
    assert.deepEqual(termHits("built on QuillFeather", FIXTURE_TERMS, FIXTURE_EXEMPTIONS), [4]);
  });

  test("exemption: the term inside the verbatim phrase passes", () => {
    assert.deepEqual(termHits("A degree from the National University of Zorbia.", FIXTURE_TERMS, FIXTURE_EXEMPTIONS), []);
  });

  test("the exemption is verbatim: a changed phrase, or the term elsewhere on the same page, still fails", () => {
    assert.deepEqual(termHits("national university of zorbia", FIXTURE_TERMS, FIXTURE_EXEMPTIONS), [3]);
    assert.deepEqual(termHits("National University of Zorbia, then work in Zorbia", FIXTURE_TERMS, FIXTURE_EXEMPTIONS), [3]);
  });

  test("the real exemption is the education credential, and removing it leaves no fragment", () => {
    assert.equal(EXEMPT_PHRASES.length, 1);
    assert.equal(withoutExemptions(`x ${EXEMPT_PHRASES[0]} y`).replace(/\s+/g, " "), "x y");
  });
});

describe("the rules beyond the list", () => {
  const named = (text: string) => ruleHits(text);

  test("departure language fails; the same word about something else passes", () => {
    for (const text of ["He resigned in March.", "I was laid off.", "after my departure", "the role was eliminated", "they let him go", "made redundant last year"]) {
      assert.deepEqual(named(text), ["departure language"], text);
    }
    for (const text of ["a departure from the requirement", "the release departed from plan", "let the build go green"]) {
      assert.deepEqual(named(text), [], text);
    }
  });

  test("the em dash, the internal title, a CIO, a board peer and Secure Score each fail; a CEO passes", () => {
    assert.deepEqual(named(`one ${String.fromCharCode(0x2014)} two`), ["em dash"]);
    assert.deepEqual(named("as Team Lead"), ["the internal title"]);
    assert.deepEqual(named("the CIO asked"), ["a CIO"]);
    assert.deepEqual(named("the CFO asked"), ["a board peer's title"]);
    assert.deepEqual(named("the chief technology officer"), ["a board peer's title"]);
    assert.deepEqual(named("the secure score rose"), ["Secure Score"]);
    assert.deepEqual(named("reporting to the CEO"), []);
    assert.ok(RULES.length >= 6);
  });
});

describe("the headcount rule", () => {
  test("condition: a headcount above 38 fails, in digits or words", () => {
    for (const text of ["a team of 64", "64 engineers", "a 64-person function", "sixty-four people", "an organisation of over 120", "50 developers", "2,500 staff"]) {
      assert.equal(headcountProblem(text), true, text);
    }
  });

  test("exemption: 38 and below pass, and a number that is not about people passes", () => {
    for (const text of ["the 38-person function", "thirty-eight people", "six people-managers", "a team of 12", "64% of releases", "Angular 13 to 21", "8 weeks", "281 automated checks", "twenty years across banking"]) {
      assert.equal(headcountProblem(text), false, text);
    }
    assert.equal(MAX_HEADCOUNT, 38);
  });

  test("numberValue reads digits, commas and number words", () => {
    assert.equal(numberValue("2,500"), 2500);
    assert.equal(numberValue("sixty-four"), 64);
    assert.equal(numberValue("thirty eight"), 38);
    assert.equal(numberValue("lots"), null);
  });
});

describe("the qualifier rule", () => {
  const metrics: Metric[] = [
    { slug: "scoped", value: "Defects down 50%", qualifier: "across the pilot teams" },
    { slug: "reviewed", value: "Held a standing role", qualifierNotRequired: true },
  ];

  test("condition: a value rendered without its qualifier fails, naming the item", () => {
    assert.deepEqual(qualifierProblems("Defects down 50%. Across the pilot teams it held.", metrics), [
      "the Headline Metric of scoped renders without its qualifier in the same sentence",
    ]);
    assert.deepEqual(qualifierProblems("Defects down 50% overall.", metrics).length, 1);
  });

  test("exemption: the qualifier in the same sentence passes, with words between", () => {
    assert.deepEqual(qualifierProblems("Defects down 50% across the pilot teams", metrics), []);
    assert.deepEqual(qualifierProblems("Defects down 50% across the two pilot teams I ran, measured weekly.", metrics), []);
  });

  test("exemption: an item reviewed as unqualified passes bare", () => {
    assert.deepEqual(qualifierProblems("Held a standing role.", metrics), []);
  });

  test("every rendering is checked, not only the first", () => {
    assert.equal(qualifierProblems("Defects down 50% across the pilot teams. Defects down 50%.", metrics).length, 1);
  });

  test("a sentence ends at a full stop before a capital, not inside .NET", () => {
    assert.equal(restOfSentence("up on .NET 10 here. Next one", 0), "up on .NET 10 here");
  });
});

describe("reading a page", () => {
  test("visible text drops scripts, styles, comments and hidden elements; metadata keeps title, meta, alt, aria-label and structured data apart", () => {
    const page = html(
      `<p>Seen</p><div hidden=""><p>zorbia</p></div><script>var zorbia</script><style>.zorbia{}</style><!-- zorbia --><img alt="A portrait" src="x"/><a aria-label="Open it" href="/">x</a><script type="application/ld+json">{"name":"Person"}</script>`,
      `<title>T</title><meta name="description" content="D"/><meta name="viewport" content="initial-scale=1"/>`,
    );
    const { text, metadata } = readablePage(page);
    assert.equal(text, "Seen x");
    assert.deepEqual(metadata, ["T", "D", "initial-scale=1", "A portrait", "Open it", '{"name":"Person"}']);
  });

  test("two neighbouring metadata values never read as one phrase", () => {
    const page = html("", `<meta name="viewport" content="scale 1"/><meta name="description" content="quillfeather-free text"/>`);
    const terms: Term[] = [{ line: 9, pattern: /scale 1 quillfeather/i }];
    assert.deepEqual(pageProblems("/", page, { terms }), []);
  });

  test("metaDescription and pageTitle", () => {
    assert.equal(metaDescription(html("")), "About the page.");
    assert.equal(metaDescription(html("", "<title>T</title>")), null);
    assert.equal(pageTitle(html("")), "A page | Site");
  });
});

describe("failure messages", () => {
  test("name the page and the rule, never the matched text, and differ from check-repo's", () => {
    const failures = pageProblems("/contact", html("<p>Work in Zorbia, and a team of 64.</p>", "<title>Quillfeather</title>"), {
      terms: FIXTURE_TERMS,
      exemptions: FIXTURE_EXEMPTIONS,
    });
    assert.deepEqual(failures, [
      { page: "/contact", rule: `its text renders a confidential term (${TERMS_FILE} line 3)` },
      { page: "/contact", rule: "its text states a headcount above 38" },
      { page: "/contact", rule: `its metadata renders a confidential term (${TERMS_FILE} line 4)` },
    ]);
    for (const failure of failures) {
      assert.doesNotMatch(failure.rule, /zorbia|quillfeather/i);
      assert.doesNotMatch(failure.rule, /matches a confidential term/);
    }
  });
});

describe("sitemap and robots", () => {
  test("sitemapPaths maps the site's own locs to paths", () => {
    assert.deepEqual(sitemapPaths("<urlset><url><loc>https://shahrouzmohaghegh.com/</loc></url><url><loc>https://shahrouzmohaghegh.com/contact</loc></url></urlset>"), ["/", "/contact"]);
  });

  test("robots must allow everything and name the sitemap", () => {
    assert.deepEqual(robotsProblems("User-Agent: *\nAllow: /\n\nSitemap: https://shahrouzmohaghegh.com/sitemap.xml\n"), []);
    assert.deepEqual(robotsProblems("User-Agent: *\nDisallow: /private\n"), [
      "does not allow /",
      "disallows a path",
      "does not point at https://shahrouzmohaghegh.com/sitemap.xml",
    ]);
  });

  test("canonicalRoutes is Home, both listings, Contact and every written detail page", () => {
    assert.deepEqual(canonicalRoutes(["a"], ["b", "c"]), ["/", "/experience", "/projects", "/contact", "/experience/a", "/projects/b", "/projects/c"]);
  });
});

// A small fake site: Home links a listing (with one filter state), Contact
// and one case study; the not-found pages answer 404.
type Site = Record<string, HttpResponse>;
// A detail page on the real written list, so the crawl expects it to answer 200.
const DETAIL = "/experience/offshore-delivery-turnaround";
const DESCRIBED = '<title>P | Site</title><meta name="description" content="A described page."/>';
const NOINDEX = '<title>F | Site</title><meta name="robots" content="noindex"/>';
function fakeSite(overrides: Site = {}): Site {
  const nav = '<a href="/experience">E</a><a href="/experience?capability=leadership">L</a><a href="/contact">C</a><a href="/experience/offshore-delivery-turnaround">A</a>';
  return {
    "/": { status: 200, body: html(`${nav}<p>Defects down 50% across the pilot teams</p>`, DESCRIBED) },
    "/experience": { status: 200, body: html(nav, DESCRIBED) },
    "/experience?capability=leadership": { status: 200, body: html(nav, NOINDEX) },
    "/contact": { status: 200, body: html(nav, DESCRIBED) },
    [DETAIL]: { status: 200, body: html(nav, DESCRIBED) },
    "/case-study-not-available": { status: 404, body: html("", NOINDEX) },
    "/project-not-available": { status: 404, body: html("", NOINDEX) },
    "/sitemap.xml": {
      status: 200,
      body: ["/", "/experience", "/contact", DETAIL].map((path) => `<url><loc>https://shahrouzmohaghegh.com${path}</loc></url>`).join(""),
    },
    "/robots.txt": { status: 200, body: "User-Agent: *\nAllow: /\nSitemap: https://shahrouzmohaghegh.com/sitemap.xml\n" },
    ...overrides,
  };
}
const httpFor =
  (site: Site): Http =>
  async (url) => {
    const { pathname, search } = new URL(url);
    return site[`${pathname}${search}`] ?? { status: 404, body: "" };
  };
const deps = (site: Site) => ({
  http: httpFor(site),
  terms: FIXTURE_TERMS,
  exemptions: FIXTURE_EXEMPTIONS,
  metrics: [{ slug: "scoped", value: "Defects down 50%", qualifier: "across the pilot teams" }],
  canonical: ["/", "/experience", "/contact", DETAIL],
});

describe("checkContent over a crawl", () => {
  test("a clean site passes, every filter state included", async () => {
    const result = await checkContent("http://localhost:3000", deps(fakeSite()));
    assert.deepEqual(result.failures, []);
    assert.equal(result.pages, 7);
  });

  test("a term on a filtered listing fails, naming that page", async () => {
    const site = fakeSite({ "/experience?capability=leadership": { status: 200, body: html("<p>zorbia</p>", NOINDEX) } });
    const result = await checkContent("http://localhost:3000", deps(site));
    assert.deepEqual(result.failures, [{ page: "/experience?capability=leadership", rule: `its text renders a confidential term (${TERMS_FILE} line 3)` }]);
  });

  test("a canonical route that carries noindex or lacks a description fails", async () => {
    const site = fakeSite({
      "/contact": { status: 200, body: html('<a href="/">H</a>', '<title>C</title><meta name="robots" content="noindex"/>') },
    });
    const result = await checkContent("http://localhost:3000", deps(site));
    assert.deepEqual(result.failures, [
      { page: "/contact", rule: "a canonical route carries a robots noindex" },
      { page: "/contact", rule: "a canonical route without a meta description" },
    ]);
  });

  test("an indexable page that is not canonical fails, and so does a sitemap that drifts", async () => {
    const site = fakeSite({
      "/experience?capability=leadership": { status: 200, body: html("", DESCRIBED) },
      "/sitemap.xml": { status: 200, body: "<url><loc>https://shahrouzmohaghegh.com/</loc></url><url><loc>https://shahrouzmohaghegh.com/experience?capability=leadership</loc></url>" },
    });
    const rules = (await checkContent("http://localhost:3000", deps(site))).failures.map((failure) => `${failure.page}: ${failure.rule}`);
    assert.ok(rules.some((rule) => rule.startsWith("/experience?capability=leadership: is indexable but is not a canonical route")));
    assert.ok(rules.includes("/contact: a canonical route missing from /sitemap.xml"));
    assert.ok(rules.includes("/sitemap.xml: lists /experience?capability=leadership, which is not a canonical route"));
  });

  test("a Headline Metric that renders nowhere, or bare, fails", async () => {
    const bare = fakeSite({ "/": { status: 200, body: html('<a href="/experience">E</a><a href="/contact">C</a><a href="/experience/offshore-delivery-turnaround">A</a><a href="/experience?capability=leadership">L</a><p>Defects down 50%.</p>', DESCRIBED) } });
    assert.deepEqual((await checkContent("http://localhost:3000", deps(bare))).failures, [
      { page: "/", rule: "the Headline Metric of scoped renders without its qualifier in the same sentence" },
    ]);
    const none = { ...deps(fakeSite()), metrics: [{ slug: "missing", value: "Never shown", qualifier: "anywhere" }] };
    assert.deepEqual((await checkContent("http://localhost:3000", none)).failures, [
      { page: "site", rule: "the Headline Metric of missing renders on no page, so its qualifier cannot be confirmed" },
    ]);
  });

  test("missing robots.txt and sitemap fail", async () => {
    const site = fakeSite();
    delete site["/robots.txt"];
    delete site["/sitemap.xml"];
    const failures = (await checkContent("http://localhost:3000", deps(site))).failures;
    assert.deepEqual(failures, [
      { page: "/sitemap.xml", rule: "answered 404, expected 200" },
      { page: "/robots.txt", rule: "answered 404, expected 200" },
    ]);
  });
});

describe("main", () => {
  const io = () => {
    const out: string[] = [];
    const err: string[] = [];
    return { out, err, sink: { out: (text: string) => out.push(text), err: (text: string) => err.push(text) } };
  };

  test("fails closed without the terms file, and says so", async () => {
    const { err, sink } = io();
    assert.equal(await main(["http://localhost:3000"], { http: httpFor(fakeSite()), readTerms: () => null, ...sink }), 1);
    assert.match(err.join(""), /\.forbidden-terms is missing/);
  });

  test("needs exactly one base URL", async () => {
    const { sink } = io();
    assert.equal(await main([], { http: httpFor(fakeSite()), readTerms: () => "zorbia", ...sink }), 2);
  });
});
