// Content integrity (AD-15). What the types in lib/evidence.ts cannot see:
// every index.ts slug has its .mdx file and every .mdx file has its entry,
// slugs are unique across both collections, each href matches its kind and
// slug, and the capabilities and Headline Metric hold up at runtime too.
// Three reviewed facts are pinned here as well: which items may skip a
// qualifier, that no dated claim is older than a year, and the display order.
// Each problem names the item, so a failing gate says what to fix.

import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

import {
  CAPABILITIES,
  EVIDENCE_ROUTE,
  caseStudyItems,
  evidenceItems,
  inCanonicalOrder,
  projectItems,
  type Capabilities,
  type EvidenceItem,
} from "@/lib/evidence";

function mdxProblems(collection: string, items: readonly EvidenceItem[], files: readonly string[]): string[] {
  const slugs = new Set(items.map((item) => item.slug));
  const mdx = new Set(files.filter((file) => file.endsWith(".mdx")).map((file) => file.slice(0, -".mdx".length)));
  return [
    ...files
      // Hidden files (a Finder .DS_Store, an editor swap file) are never content, and are gitignored or local.
      .filter((file) => !file.startsWith(".") && file !== "index.ts" && !file.endsWith(".mdx"))
      .map((file) => `${collection}: unexpected file ${file}; only index.ts and <slug>.mdx belong here`),
    ...[...slugs].filter((slug) => !mdx.has(slug)).map((slug) => `${collection}: "${slug}" has no ${slug}.mdx`),
    ...[...mdx].filter((slug) => !slugs.has(slug)).map((slug) => `${collection}: ${slug}.mdx has no entry in index.ts`),
  ];
}

function duplicateSlugs(items: readonly EvidenceItem[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const { slug } of items) (seen.has(slug) ? duplicates : seen).add(slug);
  return [...duplicates].map((slug) => `slug "${slug}" is used more than once`);
}

function itemProblems(item: EvidenceItem): string[] {
  const problems: string[] = [];
  const name = `"${item.slug}"`;
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(item.slug)) problems.push(`${name}: slug is not lowercase kebab-case`);
  const href = `${EVIDENCE_ROUTE[item.kind]}/${item.slug}`;
  if (item.href !== href) problems.push(`${name}: href ${item.href} should be ${href}`);
  if (item.title.trim() === "") problems.push(`${name}: title is empty`);
  if (item.summary.trim() === "") problems.push(`${name}: summary is empty`);

  const capabilities: readonly string[] = item.capabilities;
  if (capabilities.length === 0) problems.push(`${name}: has no capability`);
  for (const capability of capabilities) {
    if (!(CAPABILITIES as readonly string[]).includes(capability)) problems.push(`${name}: unknown capability "${capability}"`);
  }
  if (new Set(capabilities).size !== capabilities.length) problems.push(`${name}: repeats a capability`);

  const metric: Partial<Record<"value" | "qualifier" | "qualifierNotRequired", unknown>> | undefined = item.headlineMetric;
  if (metric === undefined || metric === null) {
    problems.push(`${name}: has no headline metric`);
  } else {
    if (typeof metric.value !== "string" || metric.value.trim() === "") problems.push(`${name}: headline metric has no value`);
    const qualified = typeof metric.qualifier === "string" && metric.qualifier.trim() !== "";
    const exempt = metric.qualifierNotRequired === true;
    if (qualified === exempt || ("qualifier" in metric && !qualified) || ("qualifierNotRequired" in metric && !exempt)) {
      problems.push(`${name}: headline metric needs exactly one of a non-empty qualifier or qualifierNotRequired: true`);
    }
  }
  return problems;
}

// The items whose Headline Metric may stand without a qualifier. Each one is
// a figure Shahrouz confirmed needs no scope; the escape hatch is not a way
// round FR-34.
const REVIEWED_UNQUALIFIED = ["career-application-system", "this-website"];

// The display order, reviewed. index.ts order is display order, so a
// reorder there is a content decision and is confirmed by updating this list.
const DISPLAY_ORDER = [
  "offshore-delivery-turnaround",
  "ai-native-engineering",
  "digital-governance-board",
  "career-application-system",
  "this-website",
  "platform-modernisation",
];

// A dated claim ("audited clean on <date>") goes stale; past this many days
// it fails until the claim is checked again and its date refreshed.
const DATED_CLAIM_MAX_DAYS = 365;
const DAY_MS = 24 * 60 * 60 * 1000;

function unqualifiedSlugs(items: readonly EvidenceItem[]): string[] {
  return items.filter((item) => "qualifierNotRequired" in item.headlineMetric).map((item) => item.slug);
}

// Every ISO date (YYYY-MM-DD) in a headline metric's value or qualifier that
// is more than DATED_CLAIM_MAX_DAYS before today, counted in whole UTC days,
// or that is not a real calendar date, or that is after today.
function staleClaimProblems(items: readonly EvidenceItem[], today: Date): string[] {
  const todayUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const problems: string[] = [];
  for (const item of items) {
    const metric = item.headlineMetric;
    const text = [metric.value, "qualifier" in metric ? metric.qualifier : ""].join(" ");
    for (const [date] of text.matchAll(/\b\d{4}-\d{2}-\d{2}\b/g)) {
      const at = Date.parse(`${date}T00:00:00Z`);
      // A round trip catches what Date.parse rolls over or rejects (2025-02-30, month 13).
      if (Number.isNaN(at) || new Date(at).toISOString().slice(0, 10) !== date) {
        problems.push(`"${item.slug}": headline metric date ${date} is not a real calendar date`);
        continue;
      }
      const age = Math.floor((todayUtc - at) / DAY_MS);
      if (age < 0) {
        problems.push(`"${item.slug}": headline metric date ${date} is in the future`);
      } else if (age > DATED_CLAIM_MAX_DAYS) {
        problems.push(
          `"${item.slug}": headline metric is dated ${date}, ${age} days ago; the claim needs refreshing (check it again and update the date)`,
        );
      }
    }
  }
  return problems;
}

function mdxFiles(collection: string): string[] {
  return readdirSync(fileURLToPath(new URL(`../content/${collection}/`, import.meta.url)));
}

describe("the content collections", () => {
  test("every case study has its MDX file and every MDX file has its entry", () => {
    expect(mdxProblems("case-studies", caseStudyItems, mdxFiles("case-studies"))).toEqual([]);
  });

  test("every project has its MDX file and every MDX file has its entry", () => {
    expect(mdxProblems("projects", projectItems, mdxFiles("projects"))).toEqual([]);
  });

  test("case studies are case studies and projects are projects", () => {
    expect(caseStudyItems.filter((item) => item.kind !== "case-study").map((item) => item.slug)).toEqual([]);
    expect(projectItems.filter((item) => item.kind !== "project").map((item) => item.slug)).toEqual([]);
  });

  test("slugs are unique across both collections", () => {
    expect(duplicateSlugs(evidenceItems)).toEqual([]);
  });

  test("every item has a capability, a well-formed metric and an href matching its kind and slug", () => {
    expect(evidenceItems.flatMap(itemProblems)).toEqual([]);
  });

  test("every item's capabilities come out in CAPABILITIES order", () => {
    for (const item of evidenceItems) {
      expect(item.capabilities, item.slug).toEqual(CAPABILITIES.filter((c) => item.capabilities.includes(c)));
    }
  });

  test("evidenceItems is both collections, case studies first", () => {
    expect(evidenceItems).toEqual([...caseStudyItems, ...projectItems]);
  });

  test("only reviewed items skip the qualifier", () => {
    expect(
      unqualifiedSlugs(evidenceItems).toSorted(),
      "An item uses qualifierNotRequired without review. Add its slug to REVIEWED_UNQUALIFIED only after Shahrouz confirms the figure needs no scope; otherwise give it a qualifier.",
    ).toEqual(REVIEWED_UNQUALIFIED.toSorted());
  });

  test("no dated claim is more than a year old", () => {
    expect(staleClaimProblems(evidenceItems, new Date())).toEqual([]);
  });

  test("the display order is the reviewed one", () => {
    expect(
      evidenceItems.map((item) => item.slug),
      "Order in content/*/index.ts is display order. Confirm a reorder, an addition or a removal by updating DISPLAY_ORDER in lib/evidence.test.ts.",
    ).toEqual(DISPLAY_ORDER);
  });
});

// The checks themselves, against fixtures, so a check that stops catching
// anything fails here rather than passing quietly above.
describe("the integrity checks", () => {
  const item = (over: Partial<Record<keyof EvidenceItem, unknown>> = {}): EvidenceItem =>
    ({
      slug: "x",
      kind: "project",
      title: "X",
      summary: "X.",
      capabilities: ["hands-on"],
      headlineMetric: { value: "1", qualifier: "in one place" },
      href: "/projects/x",
      ...over,
    }) as EvidenceItem;

  test("a valid item has no problems", () => {
    expect(itemProblems(item())).toEqual([]);
    expect(itemProblems(item({ headlineMetric: { value: "1", qualifierNotRequired: true } }))).toEqual([]);
  });

  test("capabilities are sorted into CAPABILITIES order, keeping every value", () => {
    const declared = ["hands-on", "ai-native", "leadership", "hands-on"] as unknown as Capabilities;
    expect(inCanonicalOrder(declared)).toEqual(["leadership", "ai-native", "hands-on", "hands-on"]);
  });

  test("a file that is neither index.ts nor .mdx is named", () => {
    expect(mdxProblems("projects", [item()], ["x.mdx", "index.ts", "y.md", "x.MDX", "Index.ts", ".DS_Store"])).toEqual([
      "projects: unexpected file y.md; only index.ts and <slug>.mdx belong here",
      "projects: unexpected file x.MDX; only index.ts and <slug>.mdx belong here",
      "projects: unexpected file Index.ts; only index.ts and <slug>.mdx belong here",
    ]);
  });

  test("an orphan MDX file is named", () => {
    expect(mdxProblems("projects", [item()], ["x.mdx", "orphan.mdx", "index.ts"])).toEqual([
      "projects: orphan.mdx has no entry in index.ts",
    ]);
  });

  test("an entry with no MDX file is named", () => {
    expect(mdxProblems("projects", [item(), item({ slug: "lonely" })], ["x.mdx", "index.ts"])).toEqual([
      'projects: "lonely" has no lonely.mdx',
    ]);
  });

  test("a duplicate slug is named, within or across collections", () => {
    expect(duplicateSlugs([item(), item()])).toEqual(['slug "x" is used more than once']);
    expect(duplicateSlugs([item({ kind: "case-study", href: "/experience/x" }), item()])).toEqual([
      'slug "x" is used more than once',
    ]);
  });

  test("unqualified items are listed, qualified ones are not", () => {
    expect(
      unqualifiedSlugs([item(), item({ slug: "y", headlineMetric: { value: "1", qualifierNotRequired: true } })]),
    ).toEqual(["y"]);
  });

  test("a dated claim fails once it is more than 365 days old, in the value or the qualifier", () => {
    const today = new Date("2026-10-10T09:00:00Z");
    const dated = (value: string, qualifier = "in one place") => item({ headlineMetric: { value, qualifier } });
    expect(staleClaimProblems([dated("Audited clean on 2025-10-10")], today)).toEqual([]);
    expect(staleClaimProblems([dated("Audited clean on 2025-10-09")], today)).toEqual([
      '"x": headline metric is dated 2025-10-09, 366 days ago; the claim needs refreshing (check it again and update the date)',
    ]);
    expect(staleClaimProblems([dated("1", "as of 2024-01-01")], today)).toHaveLength(1);
    expect(staleClaimProblems([item({ headlineMetric: { value: "On 2020-01-01", qualifierNotRequired: true } })], today)).toHaveLength(1);
    expect(staleClaimProblems([dated("Released in 2019")], today)).toEqual([]);
  });

  test("an impossible or future date in a headline metric is named, not skipped", () => {
    const today = new Date("2026-10-10T09:00:00Z");
    const dated = (value: string) => item({ headlineMetric: { value, qualifier: "in one place" } });
    expect(staleClaimProblems([dated("On 2025-02-30")], today)).toEqual([
      '"x": headline metric date 2025-02-30 is not a real calendar date',
    ]);
    expect(staleClaimProblems([dated("On 2025-13-01")], today)).toEqual([
      '"x": headline metric date 2025-13-01 is not a real calendar date',
    ]);
    expect(staleClaimProblems([dated("On 2026-10-11")], today)).toEqual(['"x": headline metric date 2026-10-11 is in the future']);
    expect(staleClaimProblems([dated("On 2026-10-10")], today)).toEqual([]);
    expect(staleClaimProblems([dated("On 2024-02-29")], today)).toHaveLength(1);
    expect(staleClaimProblems([dated("On 2024-02-29")], today)[0]).toContain("needs refreshing");
  });

  test.each([
    ["no capability", { capabilities: [] }, "has no capability"],
    ["an unknown capability", { capabilities: ["devops"] }, 'unknown capability "devops"'],
    ["a repeated capability", { capabilities: ["hands-on", "hands-on"] }, "repeats a capability"],
    ["no metric", { headlineMetric: undefined }, "has no headline metric"],
    ["an empty metric value", { headlineMetric: { value: " ", qualifier: "q" } }, "has no value"],
    ["a bare value", { headlineMetric: { value: "1" } }, "exactly one of"],
    ["an empty qualifier", { headlineMetric: { value: "1", qualifier: "" } }, "exactly one of"],
    ["both qualifier and flag", { headlineMetric: { value: "1", qualifier: "q", qualifierNotRequired: true } }, "exactly one of"],
    ["a false flag", { headlineMetric: { value: "1", qualifierNotRequired: false } }, "exactly one of"],
    ["an href on the wrong route", { href: "/experience/x" }, "should be /projects/x"],
    ["an href with the wrong slug", { href: "/projects/y" }, "should be /projects/x"],
    ["a slug that is not kebab-case", { slug: "Not Kebab", href: "/projects/Not Kebab" }, "not lowercase kebab-case"],
  ])("%s is named", (_label, over, expected) => {
    const problems = itemProblems(item(over));
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain(expected);
  });
});
