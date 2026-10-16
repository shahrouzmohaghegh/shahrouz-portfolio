// Tests for check-content.mts. Run with: npm run test:scripts
//
// Every conditional rule is tested both ways: the condition that must fail
// and the exemption that must pass. The confidential terms are never named
// here: the term tests use invented fixture words, and the real list is read
// from .forbidden-terms only when the script runs. The HTTP layer is a fake.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { site } from "../content/site.ts";
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
  previewProblems,
  SITE_ORIGIN,
  sitemapDuplicates,
  withoutHidden,
  attributeNames,
  BLOCK,
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
    for (const text of ["He resigned in March.", "I was laid off.", "after my departure", "the role was eliminated", "they let him go", "made redundant last year", "his contract was terminated", "we parted ways in May"]) {
      assert.deepEqual(named(text), ["departure language"], text);
    }
    for (const text of ["a departure from the requirement", "the release departed from plan", "let the build go green", "moved on from the old pipeline", "parted the work into stages"]) {
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
    for (const text of ["a team of 64", "64 engineers", "a 64-person function", "sixty-four people", "an organisation of over 120", "50 developers", "2,500 staff", "40+ engineers", "two hundred engineers", "one thousand two hundred and fifty staff", "a hundred people", "45 teams", "a group of 40+"]) {
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
    assert.equal(numberValue("40+"), 40);
    assert.equal(numberValue("two hundred"), 200);
    assert.equal(numberValue("one thousand two hundred and fifty"), 1250);
    assert.equal(numberValue("a hundred"), 100);
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

  test("a block boundary ends the sentence: a qualifier in the next paragraph does not count", () => {
    const text = readablePage(html("<p>Defects down 50%</p><p>across the pilot teams</p>")).text;
    assert.equal(qualifierProblems(text, metrics).length, 1);
    const same = readablePage(html("<p>Defects down 50% <strong>across</strong> the pilot teams</p>")).text;
    assert.deepEqual(qualifierProblems(same, metrics), []);
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
    assert.equal(text.split(BLOCK).join(" ").replace(/\s+/g, " ").trim(), "Seen x");
    assert.ok(text.includes(BLOCK), "block boundaries are marked");
    assert.deepEqual(metadata, ["T", "D", "initial-scale=1", "A portrait", "Open it", '{"name":"Person"}']);
  });

  test("hidden is read only as an attribute name: a class or value that says hidden is still scanned", () => {
    assert.equal(readablePage(html('<p class="a hidden">Seen</p><p data-x="hidden">Also</p>')).text.split(BLOCK).join(" ").replace(/\s+/g, " ").trim(), "Seen Also");
    assert.deepEqual(attributeNames(' class="a hidden" data-note=\'x hidden\' hidden'), ["class", "data-note", "hidden"]);
  });

  test("a hidden element is dropped whole, nested children of the same name included", () => {
    const text = readablePage(html('<div hidden><div>inner</div>still hidden</div><p>Seen</p><template><p>t</p></template>')).text;
    assert.doesNotMatch(text, /inner|still hidden|\bt\b/);
    assert.match(text, /Seen/);
    assert.equal(withoutHidden('<span hidden="">x</span>y<img hidden alt="z"/>w').replace(/\s+/g, " ").trim(), "y w");
  });

  test("the document title is read from the head only", () => {
    assert.equal(pageTitle("<html><head></head><body><svg><title>Icon</title></svg></body></html>"), null);
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
// A canonical route's head as the root layout and the route emit it: its
// own title and description, the preview tags, one Person block and the
// canonical link on the live domain.
const PERSON = '<script type="application/ld+json">{"@context":"https://schema.org","@type":"Person","name":"N"}</script>';
const described = (path: string, extra = ""): string =>
  '<title>P | Site</title><meta name="description" content="A described page."/>' +
  `<link rel="canonical" href="https://shahrouzmohaghegh.com${path === "/" ? "" : path}"/>` +
  '<meta property="og:title" content="P | Site"/><meta property="og:description" content="A described page."/>' +
  '<meta property="og:site_name" content="Site"/><meta property="og:image" content="https://shahrouzmohaghegh.com/opengraph-image?abc"/>' +
  `<meta name="twitter:card" content="summary_large_image"/>${PERSON}${extra}`;
const NOINDEX = '<title>F | Site</title><meta name="robots" content="noindex"/>';
function fakeSite(overrides: Site = {}): Site {
  const nav = '<a href="/experience">E</a><a href="/experience?capability=leadership">L</a><a href="/contact">C</a><a href="/experience/offshore-delivery-turnaround">A</a>';
  return {
    "/": { status: 200, body: html(`${nav}<p>Defects down 50% across the pilot teams</p>`, described("/")) },
    "/experience": { status: 200, body: html(nav, described("/experience")) },
    "/experience?capability=leadership": { status: 200, body: html(nav, NOINDEX) },
    "/contact": { status: 200, body: html(nav, described("/contact")) },
    [DETAIL]: { status: 200, body: html(nav, described(DETAIL)) },
    "/opengraph-image": { status: 200, body: "PNG", contentType: "image/png" },
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
      "/contact": {
        status: 200,
        body: html('<a href="/">H</a>', described("/contact").replace(/<meta (name|property)="(og:)?description"[^>]*>/g, "") + '<meta name="robots" content="noindex"/>'),
      },
    });
    const result = await checkContent("http://localhost:3000", deps(site));
    assert.deepEqual(result.failures, [
      { page: "/contact", rule: "a canonical route carries a robots noindex" },
      { page: "/contact", rule: "a canonical route without a meta description" },
    ]);
  });

  test("an indexable page that is not canonical fails, and so does a sitemap that drifts", async () => {
    const site = fakeSite({
      "/experience?capability=leadership": { status: 200, body: html("", described("/experience?capability=leadership")) },
      "/sitemap.xml": { status: 200, body: "<url><loc>https://shahrouzmohaghegh.com/</loc></url><url><loc>https://shahrouzmohaghegh.com/experience?capability=leadership</loc></url>" },
    });
    const rules = (await checkContent("http://localhost:3000", deps(site))).failures.map((failure) => `${failure.page}: ${failure.rule}`);
    assert.ok(rules.some((rule) => rule.startsWith("/experience?capability=leadership: is indexable but is not a canonical route")));
    assert.ok(rules.includes("/contact: a canonical route missing from /sitemap.xml"));
    assert.ok(rules.includes("/sitemap.xml: lists /experience?capability=leadership, which is not a canonical route"));
  });

  test("a Headline Metric that renders nowhere, or bare, fails", async () => {
    const bare = fakeSite({ "/": { status: 200, body: html('<a href="/experience">E</a><a href="/contact">C</a><a href="/experience/offshore-delivery-turnaround">A</a><a href="/experience?capability=leadership">L</a><p>Defects down 50%.</p>', described("/")) } });
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

describe("link previews and the sitemap, rendered", () => {
  test("a canonical route whose preview drifts fails, rule by rule", async () => {
    const drifted = html(
      '<a href="/">H</a>',
      '<title>C | Site</title><meta name="description" content="Contact."/><link rel="canonical" href="https://example.com/contact"/>' +
        '<meta property="og:title" content="Other"/><meta property="og:description" content="Other."/><meta property="og:image" content="https://shahrouzmohaghegh.com/portrait.png"/>' +
        `<meta name="twitter:card" content="summary"/>${PERSON}${PERSON}`,
    );
    const failures = (await checkContent("http://localhost:3000", deps(fakeSite({ "/contact": { status: 200, body: drifted } })))).failures;
    assert.deepEqual(
      failures.map((failure) => failure.rule),
      [
        "link preview: og:title is not the page title",
        "link preview: og:description is not the meta description",
        "link preview: og:image is not the generated /opengraph-image",
        "link preview: has no og:site_name",
        "link preview: twitter:card is not summary_large_image",
        "link preview: carries 2 Person structured data block(s), expected exactly one",
        "link preview: its canonical link is not this route on https://shahrouzmohaghegh.com",
      ],
    );
    assert.ok(failures.every((failure) => failure.page === "/contact"));
  });

  test("previewProblems passes the route's own head and fails a missing canonical link", () => {
    assert.deepEqual(previewProblems("/contact", html("", described("/contact"))), []);
    assert.deepEqual(previewProblems("/", html("", described("/"))), []);
    assert.deepEqual(previewProblems("/contact", html("", described("/contact").replace(/<link rel="canonical"[^>]*>/, ""))), ["its canonical link is missing"]);
  });

  test("the preview image must answer as a PNG", async () => {
    const wrong = await checkContent("http://localhost:3000", deps(fakeSite({ "/opengraph-image": { status: 200, body: "<html>", contentType: "text/html" } })));
    assert.deepEqual(wrong.failures, [{ page: "/opengraph-image", rule: "is not served as image/png" }]);
    const missing = fakeSite();
    delete missing["/opengraph-image"];
    assert.deepEqual((await checkContent("http://localhost:3000", deps(missing))).failures, [{ page: "/opengraph-image", rule: "answered 404, expected 200" }]);
  });

  test("a sitemap that lists a route twice fails", async () => {
    const twice = ["/", "/experience", "/contact", DETAIL, "/contact"].map((path) => `<url><loc>https://shahrouzmohaghegh.com${path}</loc></url>`).join("");
    const failures = (await checkContent("http://localhost:3000", deps(fakeSite({ "/sitemap.xml": { status: 200, body: twice } })))).failures;
    assert.deepEqual(failures, [{ page: "/sitemap.xml", rule: "lists /contact more than once" }]);
    assert.deepEqual(sitemapDuplicates(["/a", "/b", "/a", "/a"]), ["/a"]);
  });

  test("the domain is content/site.ts's", () => {
    assert.equal(SITE_ORIGIN, new URL(site.url).origin);
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
