// Content integrity (AD-15). What the types in lib/evidence.ts cannot see:
// every index.ts slug has its .mdx file and every .mdx file has its entry,
// slugs are unique across both collections, each href matches its kind and
// slug, and the capabilities and Headline Metric hold up at runtime too.
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
