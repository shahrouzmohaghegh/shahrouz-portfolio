// Nothing confidential or unqualified reaches the rendered site (Story 5.2,
// FR-29, FR-34), and every canonical page is findable (Story 5.6). Run in the
// gate against `next start`, after the build:
//
//   node scripts/check-content.mts <base-url>     e.g. http://localhost:3000
//
// The pages are the link check's own crawl (crawlSite in
// scripts/check-links.mts): every route, both detail families and every
// filter state on both listings, read with plain fetch. Each page is reduced
// to what a reader or a link preview sees: the visible text (scripts, styles,
// templates, comments and hidden elements dropped), the alt, aria-label and
// title attributes, the <title>, every <meta> content, and the Person
// structured data. Then, per page:
//
// 1. Confidential terms. Every pattern in .forbidden-terms (read as
//    scripts/check-repo.mts reads it: missing, empty or invalid fails
//    closed, and a pattern is only ever named by its line number). That
//    list carries the former employer, its products, systems and projects,
//    the departure words the spec names, the restricted figures and the one
//    country name. EXEMPT_PHRASES are removed first, verbatim, so the
//    education credential passes and the bare country name still fails.
// 2. The rules beyond the list (RULES): departure language, the internal
//    title, any CIO, a board peer's title, Secure Score and the em dash.
// 3. A headcount above 38 (headcountProblem): a number, in digits or words,
//    attached to people ("64 engineers", "a team of 64", "a 64-person
//    function"). 38 and below pass; a number not about people passes.
// 4. Qualifiers. Wherever an Evidence Item's Headline Metric value renders,
//    its qualifier follows it in the same sentence, unless the item is
//    qualifierNotRequired, which lib/evidence.test.ts allows only for the
//    reviewed list. Each metric must render somewhere, so the rule is never
//    vacuous.
// 5. Metadata. Every canonical route (canonicalRoutes) is crawled, answers
//    200, carries no robots noindex and has a <title> and a meta
//    description; every other page that answers 200 (a filtered listing)
//    carries noindex; /sitemap.xml lists exactly the canonical routes; and
//    /robots.txt allows everything and names the sitemap.
//
// Failures name the page and the rule, never the matched text, and read
// differently from check-repo's, so a log says which check failed. Exit 1
// on any failure.

import { existsSync, readFileSync } from "node:fs";

import { caseStudies, writtenCaseStudySlugs } from "../content/case-studies/index.ts";
import { projects, writtenProjectSlugs } from "../content/projects/index.ts";
import { crawlSite, decodeEntities, hasNoindex, makeHttp, type Http } from "./check-links.mts";
import { isEntryPoint } from "./entry-point.mts";

export const TERMS_FILE = ".forbidden-terms";
export const SITE_ORIGIN = "https://shahrouzmohaghegh.com";

// Phrases a term may appear inside, verbatim: the education credential
// (Addendum section 3), which must pass as written.
export const EXEMPT_PHRASES = ["National University of Iran"] as const;

// The canonical, indexable routes (Story 5.6): Home, both listings
// unfiltered, Contact and every written detail page. app/sitemap.ts lists
// exactly these, and app/sitemap.test.ts holds the two together.
export function canonicalRoutes(writtenCaseStudies: readonly string[] = writtenCaseStudySlugs, writtenProjects: readonly string[] = writtenProjectSlugs): string[] {
  return ["/", "/experience", "/projects", "/contact", ...writtenCaseStudies.map((slug) => `/experience/${slug}`), ...writtenProjects.map((slug) => `/projects/${slug}`)];
}

// The highest headcount the site may state or imply (UX-DR41).
export const MAX_HEADCOUNT = 38;

export type Term = { line: number; pattern: RegExp };
export type Rule = { name: string; pattern: RegExp };

// What the confidentiality rule bans beyond the terms file. The two
// departure words the spec names are in the terms file itself, so they are
// not written here; these are their equivalents.
export const RULES: readonly Rule[] = [
  { name: "em dash", pattern: new RegExp(String.fromCharCode(0x2014)) },
  {
    name: "departure language",
    pattern:
      /\b(resigned|resignation|managed out|let (him|her|them|me) go|laid off|lay-?offs?|made redundant|was fired|were fired|(my|his) (departure|exit)|(departed|left) the (company|business|organisation|organization)|(role|position|job) was (cut|eliminated|abolished))\b/i,
  },
  { name: "the internal title", pattern: /\bteam leads?\b/i },
  { name: "a CIO", pattern: /\bCIO\b/i },
  {
    name: "a board peer's title",
    pattern:
      /\b(CFO|CTO|COO|CISO)\b|\bhead of (operations|security)\b|\bchief (financial|technology|operating|information security|information|digital( and information)?) officer\b/i,
  },
  { name: "Secure Score", pattern: /\bsecure score\b/i },
];

export class TermsError extends Error {}

// The patterns, one per non-blank, non-# line, case-insensitive. A pattern
// is never quoted: an invalid one is reported by line number only.
export function parseTerms(text: string | null): Term[] {
  if (text === null) throw new TermsError(`${TERMS_FILE} is missing, so confidential terms cannot be checked`);
  const terms: Term[] = [];
  text.split("\n").forEach((raw, i) => {
    const line = raw.trim();
    if (!line || line.startsWith("#")) return;
    try {
      terms.push({ line: i + 1, pattern: new RegExp(line, "i") });
    } catch {
      throw new TermsError(`${TERMS_FILE} line ${i + 1} is not a valid pattern`);
    }
  });
  if (terms.length === 0) throw new TermsError(`${TERMS_FILE} holds no terms, so confidential terms cannot be checked`);
  return terms;
}

// ---------------------------------------------------------------- reading a page

const ATTRIBUTE = (name: string): RegExp => new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, "i");

// Elements whose content no reader sees: hidden, templates and noscript.
function withoutHidden(html: string): string {
  let out = html.replace(/<(template|noscript)\b[\s\S]*?<\/\1\s*>/gi, " ");
  // A hidden element, by tag name; nested elements of the same name are rare
  // in this markup (Next.js's own hidden div holds only comments).
  out = out.replace(/<([a-z][a-z0-9-]*)\b[^>]*\shidden(?:\s*=\s*(?:"[^"]*"|'[^']*'))?[^>]*>[\s\S]*?<\/\1\s*>/gi, " ");
  return out;
}

const collapse = (text: string): string => text.replace(/\s+/g, " ").trim();

// What a reader or a link preview sees of one page, in two parts: the visible
// body text, and the metadata (title, every meta content, the structured
// data and the alt, aria-label and title attributes), each piece of it kept
// apart so two neighbouring values never read as one phrase.
export function readablePage(html: string): { text: string; metadata: string[] } {
  const noComments = html.replace(/<!--[\s\S]*?-->/g, "");
  const structured = [...noComments.matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script\s*>/gi)].map((m) => m[1]);
  const noScripts = noComments.replace(/<(script|style)\b[\s\S]*?<\/\1\s*>/gi, " ");
  const head = /<head\b[^>]*>([\s\S]*?)<\/head\s*>/i.exec(noScripts)?.[1] ?? "";
  const body = /<body\b[^>]*>([\s\S]*?)<\/body\s*>/i.exec(noScripts)?.[1] ?? noScripts.replace(/<head\b[\s\S]*?<\/head\s*>/i, " ");
  const visible = withoutHidden(body);
  const text = collapse(decodeEntities(visible.replace(/<[^>]+>/g, " ")));
  const meta: string[] = [];
  const title = /<title\b[^>]*>([\s\S]*?)<\/title\s*>/i.exec(head)?.[1];
  if (title !== undefined) meta.push(title);
  for (const tag of head.matchAll(/<meta\b[^>]*>/gi)) {
    const content = ATTRIBUTE("content").exec(tag[0]);
    if (content) meta.push(content[1] ?? content[2]);
  }
  for (const tag of visible.matchAll(/<[a-z][^>]*>/gi)) {
    for (const name of ["alt", "aria-label", "title"]) {
      const value = ATTRIBUTE(name).exec(tag[0]);
      if (value) meta.push(value[1] ?? value[2]);
    }
  }
  meta.push(...structured);
  return { text, metadata: meta.map((value) => collapse(decodeEntities(value))).filter(Boolean) };
}

// The meta description's content, or null when there is none.
export function metaDescription(html: string): string | null {
  for (const tag of html.matchAll(/<meta\b[^>]*>/gi)) {
    if (!/\bname\s*=\s*["']?description["'\s>]/i.test(tag[0])) continue;
    const content = ATTRIBUTE("content").exec(tag[0]);
    return content ? decodeEntities(content[1] ?? content[2]).trim() : "";
  }
  return null;
}

export function pageTitle(html: string): string | null {
  const title = /<title\b[^>]*>([\s\S]*?)<\/title\s*>/i.exec(html)?.[1];
  return title === undefined ? null : decodeEntities(title).trim();
}

// ---------------------------------------------------------------- the rules

// The text with every exempt phrase removed, verbatim (case and all).
export function withoutExemptions(text: string, exemptions: readonly string[] = EXEMPT_PHRASES): string {
  return exemptions.reduce((out, phrase) => out.split(phrase).join(" "), text);
}

// The terms file lines a text matches, after the exemptions.
export function termHits(text: string, terms: readonly Term[], exemptions: readonly string[] = EXEMPT_PHRASES): number[] {
  const scanned = withoutExemptions(text, exemptions);
  return terms.filter((term) => term.pattern.test(scanned)).map((term) => term.line);
}

export function ruleHits(text: string, rules: readonly Rule[] = RULES): string[] {
  return rules.filter((rule) => rule.pattern.test(text)).map((rule) => rule.name);
}

const NUMBER_WORDS: Record<string, number> = Object.fromEntries([
  ...["one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"].map(
    (word, i) => [word, i + 1] as const,
  ),
  ...["twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"].map((word, i) => [word, (i + 2) * 10] as const),
  ["hundred", 100] as const,
]);
const UNITS = "one|two|three|four|five|six|seven|eight|nine";
const TENS = "twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety";
const WORD_NUMBER = `(?:(?:${TENS})(?:[- ](?:${UNITS}))?|${Object.keys(NUMBER_WORDS).join("|")})`;
const NUMBER = `(\\d[\\d,]*|${WORD_NUMBER})`;
const PEOPLE = "(?:people|persons?|engineers?|developers?|staff|employees|heads|headcount|team members|members|reports|direct reports|testers|FTEs?)";

// A number attached to people: "N people", "N-person", "N-strong", "a team
// of N", "headcount of N", "N engineers". Group 1 is the number as written.
const HEADCOUNT_PATTERNS = [
  new RegExp(`\\b${NUMBER}(?:\\s+|-)(?:[a-z-]+\\s+){0,2}?${PEOPLE}\\b`, "gi"),
  new RegExp(`\\b${NUMBER}-(?:person|people|strong|member)\\b`, "gi"),
  new RegExp(`\\b(?:team|function|organisation|organization|department|headcount|group) of (?:about |around |over |more than |nearly |some )?${NUMBER}\\b`, "gi"),
];

export function numberValue(written: string): number | null {
  const text = written.toLowerCase().trim();
  if (/^\d[\d,]*$/.test(text)) return Number(text.replace(/,/g, ""));
  const parts = text.split(/[- ]/);
  let total = 0;
  for (const part of parts) {
    const value = NUMBER_WORDS[part];
    if (value === undefined) return null;
    total += value;
  }
  return total;
}

// Whether a text states a headcount above MAX_HEADCOUNT.
export function headcountProblem(text: string, max = MAX_HEADCOUNT): boolean {
  for (const pattern of HEADCOUNT_PATTERNS) {
    for (const match of text.matchAll(pattern)) {
      const value = numberValue(match[1]);
      if (value !== null && value > max) return true;
    }
  }
  return false;
}

export type Metric = { slug: string; value: string; qualifier?: string; qualifierNotRequired?: true };

const words = (text: string): string[] => text.toLowerCase().match(/[\p{L}\p{N}%$.-]+/gu)?.map((word) => word.replace(/^[.-]+|[.-]+$/g, "")).filter(Boolean) ?? [];

// The rest of the sentence a position starts: up to a full stop, question or
// exclamation mark followed by a space and a capital, or the end.
export function restOfSentence(text: string, from: number): string {
  const end = /[.!?](?=\s+[\p{Lu}\d"“]|\s*$)/u.exec(text.slice(from));
  return end === null ? text.slice(from) : text.slice(from, from + end.index);
}

// Whether every word of the qualifier appears, in order, in the words.
const inOrder = (needle: readonly string[], haystack: readonly string[]): boolean => {
  let at = 0;
  for (const word of haystack) if (at < needle.length && word === needle[at]) at++;
  return at === needle.length;
};

// The Headline Metric problems on one page's text: wherever a value renders,
// the rest of its sentence carries every word of its qualifier, in order
// (FR-34: the qualifier sits in the same sentence as the figure; prose may
// add words between). An item reviewed as qualifierNotRequired is exempt.
export function qualifierProblems(text: string, metrics: readonly Metric[]): string[] {
  const problems: string[] = [];
  for (const metric of metrics) {
    if (metric.qualifierNotRequired === true || metric.qualifier === undefined) continue;
    const qualifier = words(metric.qualifier);
    let from = 0;
    for (;;) {
      const at = text.indexOf(metric.value, from);
      if (at === -1) break;
      from = at + metric.value.length;
      if (!inOrder(qualifier, words(restOfSentence(text, from)))) {
        problems.push(`the Headline Metric of ${metric.slug} renders without its qualifier in the same sentence`);
        break;
      }
    }
  }
  return problems;
}

// ---------------------------------------------------------------- sitemap and robots

// The paths a sitemap lists, each <loc> on the site's origin mapped to its
// path (query kept); a <loc> on another origin is kept whole.
export function sitemapPaths(xml: string, origin = SITE_ORIGIN): string[] {
  return [...xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/g)].map((match) => {
    const loc = decodeEntities(match[1]);
    try {
      const url = new URL(loc);
      return url.origin === origin ? `${url.pathname}${url.search}` : loc;
    } catch {
      return loc;
    }
  });
}

export function robotsProblems(text: string, origin = SITE_ORIGIN): string[] {
  const lines = text.split(/\r?\n/).map((line) => line.replace(/#.*/, "").trim()).filter(Boolean);
  const problems: string[] = [];
  if (!lines.some((line) => /^user-agent\s*:\s*\*$/i.test(line))) problems.push("does not address every user agent");
  if (!lines.some((line) => /^allow\s*:\s*\/$/i.test(line))) problems.push("does not allow /");
  if (lines.some((line) => /^disallow\s*:\s*\S/i.test(line))) problems.push("disallows a path");
  if (!lines.some((line) => line.toLowerCase() === `sitemap: ${origin}/sitemap.xml`)) problems.push(`does not point at ${origin}/sitemap.xml`);
  return problems;
}

// ---------------------------------------------------------------- check

export type Failure = { page: string; rule: string };

export type Deps = {
  http: Http;
  terms: readonly Term[];
  metrics?: readonly Metric[];
  exemptions?: readonly string[];
  canonical?: readonly string[];
  maxPages?: number;
};

export const evidenceMetrics = (): Metric[] =>
  [...caseStudies, ...projects].map((item) => ({ slug: item.slug, ...item.headlineMetric }));

// One page's confidentiality and qualifier failures.
export function pageProblems(page: string, html: string, deps: Pick<Deps, "terms" | "metrics" | "exemptions">): Failure[] {
  const { text, metadata } = readablePage(html);
  const rules = new Set<string>();
  for (const [part, values] of [
    ["text", [text]],
    ["metadata", metadata],
  ] as const) {
    for (const value of values) {
      for (const line of termHits(value, deps.terms, deps.exemptions ?? EXEMPT_PHRASES)) {
        rules.add(`its ${part} renders a confidential term (${TERMS_FILE} line ${line})`);
      }
      for (const name of ruleHits(value)) rules.add(`its ${part} renders ${name}`);
      if (headcountProblem(value)) rules.add(`its ${part} states a headcount above ${MAX_HEADCOUNT}`);
    }
  }
  for (const rule of qualifierProblems(text, deps.metrics ?? [])) rules.add(rule);
  return [...rules].map((rule) => ({ page, rule }));
}

export type Result = { pages: number; canonical: string[]; failures: Failure[] };

export async function checkContent(baseUrl: string, deps: Deps): Promise<Result> {
  const origin = new URL(baseUrl).origin;
  const metrics = deps.metrics ?? evidenceMetrics();
  const canonical = deps.canonical ?? canonicalRoutes();
  const failures: Failure[] = [];
  const crawl = await crawlSite(baseUrl, { http: deps.http, maxPages: deps.maxPages });
  if (crawl.stoppedWithQueued !== null) failures.push({ page: "crawl", rule: `stopped after ${crawl.maxPages} pages; the content check needs the whole site` });

  const rendered = new Set<string>();
  const crawled = new Set<string>();
  for (const page of crawl.pages) {
    crawled.add(page.path);
    if (page.status === null) {
      failures.push({ page: page.path, rule: "did not answer, so its content cannot be checked" });
      continue;
    }
    if (page.status !== page.expected) {
      failures.push({ page: page.path, rule: `answered ${page.status}, expected ${page.expected}` });
      continue;
    }
    failures.push(...pageProblems(page.path, page.body, { ...deps, metrics }));
    const { text } = readablePage(page.body);
    for (const metric of metrics) if (text.includes(metric.value)) rendered.add(metric.slug);
    if (page.status !== 200) continue;
    const noindex = hasNoindex(page.body);
    if (canonical.includes(page.path)) {
      if (noindex) failures.push({ page: page.path, rule: "a canonical route carries a robots noindex" });
      if (!pageTitle(page.body)) failures.push({ page: page.path, rule: "a canonical route without a <title>" });
      if (!metaDescription(page.body)) failures.push({ page: page.path, rule: "a canonical route without a meta description" });
    } else if (!noindex) {
      failures.push({ page: page.path, rule: "is indexable but is not a canonical route; give it a robots noindex or add it to canonicalRoutes and the sitemap" });
    }
  }
  for (const path of canonical) {
    if (!crawled.has(path)) failures.push({ page: path, rule: "a canonical route no page links to, so the crawl never reached it" });
  }
  for (const metric of metrics) {
    if (!rendered.has(metric.slug)) failures.push({ page: "site", rule: `the Headline Metric of ${metric.slug} renders on no page, so its qualifier cannot be confirmed` });
  }

  // The sitemap lists exactly the canonical routes.
  try {
    const sitemap = await deps.http(new URL("/sitemap.xml", origin).href, { follow: false });
    if (sitemap.status !== 200) {
      failures.push({ page: "/sitemap.xml", rule: `answered ${sitemap.status}, expected 200` });
    } else {
      const listed = sitemapPaths(sitemap.body);
      for (const path of canonical) if (!listed.includes(path)) failures.push({ page: path, rule: "a canonical route missing from /sitemap.xml" });
      for (const path of listed) if (!canonical.includes(path)) failures.push({ page: "/sitemap.xml", rule: `lists ${path}, which is not a canonical route` });
    }
  } catch {
    failures.push({ page: "/sitemap.xml", rule: "did not answer" });
  }
  try {
    const robots = await deps.http(new URL("/robots.txt", origin).href, { follow: false });
    if (robots.status !== 200) failures.push({ page: "/robots.txt", rule: `answered ${robots.status}, expected 200` });
    else for (const problem of robotsProblems(robots.body)) failures.push({ page: "/robots.txt", rule: problem });
  } catch {
    failures.push({ page: "/robots.txt", rule: "did not answer" });
  }
  return { pages: crawl.pages.length, canonical: [...canonical], failures };
}

export function report(result: Result): string {
  const lines = result.failures.map((failure) => `  ${failure.page}: ${failure.rule}`);
  const summary = `${result.pages} page(s) read, ${result.canonical.length} canonical`;
  return result.failures.length === 0
    ? `check-content: ${summary}; nothing confidential or unqualified renders, and every canonical page is findable.\n`
    : `check-content: ${summary}; ${result.failures.length} failure(s) in the rendered site:\n${lines.join("\n")}\n`;
}

export async function main(argv: string[], deps: { http: Http; readTerms: () => string | null; out: (text: string) => void; err: (text: string) => void }): Promise<number> {
  const base = argv[0];
  if (base === undefined || argv.length !== 1 || !/^https?:\/\//.test(base)) {
    deps.err("usage: node scripts/check-content.mts <base-url>");
    return 2;
  }
  let terms: Term[];
  try {
    terms = parseTerms(deps.readTerms());
  } catch (error) {
    deps.err(`check-content: ${error instanceof TermsError ? error.message : "the confidential terms could not be read"}`);
    return 1;
  }
  const result = await checkContent(base, { http: deps.http, terms });
  deps.out(report(result));
  return result.failures.length === 0 ? 0 : 1;
}

if (isEntryPoint(import.meta.url)) {
  main(process.argv.slice(2), {
    http: makeHttp(),
    readTerms: () => (existsSync(TERMS_FILE) ? readFileSync(TERMS_FILE, "utf8") : null),
    out: (text) => process.stdout.write(text),
    err: (text) => console.error(text),
  }).then(
    (code) => process.exit(code),
    (error: unknown) => {
      console.error(`check-content: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    },
  );
}
