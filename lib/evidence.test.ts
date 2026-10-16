// Content integrity (AD-15). What the types in lib/evidence.ts cannot see:
// every index.ts slug has its .mdx file and every .mdx file has its entry,
// slugs are unique across both collections, each href matches its kind and
// slug, and the capabilities and Headline Metric hold up at runtime too.
// Three reviewed facts are pinned here as well: which items may skip a
// qualifier, that no dated claim is older than a year, and the display order.
// Each problem names the item, so a failing gate says what to fix.

import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

import { writtenCaseStudySlugs } from "@/content/case-studies";
import { writtenProjectSlugs } from "@/content/projects";
import { experience } from "@/content/experience";
import { projectsPage } from "@/content/projects-page";
import { CAPABILITY_SLUGS, selectedCapabilities } from "@/scripts/check-links.mts";
import { CI_PATH, gateStepNames } from "@/scripts/check-readme.mts";

import {
  CAPABILITIES,
  CAPABILITY_NAME,
  CASE_STUDY_SECTIONS,
  EVIDENCE_ROUTE,
  PROJECT_SECTION_GROUPS,
  PROJECT_SECTIONS,
  caseStudyItems,
  evidenceItems,
  inCanonicalOrder,
  isWritten,
  listingHref,
  listingTitle,
  matchesSelection,
  nextWrittenItem,
  OTHER_KIND,
  CAPABILITY_PARAM,
  crossListing,
  filterChips,
  filterItems,
  filterLinkHref,
  isListingPath,
  joinCapabilityNames,
  parseSelection,
  selectionFrom,
  serialiseSelection,
  stateLine,
  toggleCapability,
  projectItems,
  sectionsOf,
  writtenItems,
  type Capabilities,
  type Capability,
  type EvidenceItem,
  type EvidenceKind,
} from "@/lib/evidence";

// The this-website Headline Metric states how many checks run on every
// merge, so the count is read from the gate rather than trusted. Each gate
// step is classified here by name, setup or check: a step in neither list
// fails the suite by name, so adding one (say, a browser install for the
// end-to-end test) forces a decision instead of silently changing the claim.
const SETUP_STEPS = [
  "Check out full history",
  "Restore confidential term list",
  "Set up Node from .nvmrc",
  "Install dependencies",
];
const CHECK_STEPS = [
  "Lint",
  "Type check",
  "Script tests",
  "Unit tests",
  "Build",
  "Link check (next start, every page and external link)",
  "Token drift check",
  "Repository scan (tree, every blob and commit message in history)",
  "Secret scan (gitleaks, full history)",
  "README check",
  "Content review check",
  "Branch protection check",
];
const COUNT_WORDS = ["Zero", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
  "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen", "Twenty"];

function classifySteps(steps: readonly string[]): { checks: string[]; problems: string[] } {
  const known = new Set([...SETUP_STEPS, ...CHECK_STEPS]);
  return {
    checks: steps.filter((step) => CHECK_STEPS.includes(step)),
    problems: [
      ...steps
        .filter((step) => !known.has(step))
        .map((step) => `${CI_PATH}: gate step "${step}" is neither setup nor a check; add it to SETUP_STEPS or CHECK_STEPS in lib/evidence.test.ts`),
      ...[...known]
        .filter((name) => !steps.includes(name))
        .map((name) => `lib/evidence.test.ts lists "${name}", which is not a gate step in ${CI_PATH}`),
    ],
  };
}

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

// Each kind's collection directory, the noun its problems use and the name
// of its committed written list.
const COLLECTION = {
  "case-study": { dir: "case-studies", noun: "case study", list: "writtenCaseStudySlugs" },
  project: { dir: "projects", noun: "project", list: "writtenProjectSlugs" },
} as const satisfies Record<EvidenceKind, { dir: string; noun: string; list: string }>;

// A written item (non-empty MDX) holds exactly its kind's sections, in
// sectionsOf(kind) order (five for a case study, eight for a project), each
// as one <Section name="..."> (the name in double or single quotes, or a
// braced string), and nothing else: no text outside a Section, and no
// Markdown heading anywhere, since each section's only heading is the h2
// Section renders. An empty file is unwritten and is not checked here; it
// gets no page.
const SECTION_NAME = /\bname=(?:"([^"]*)"|'([^']*)'|\{\s*"([^"]*)"\s*\}|\{\s*'([^']*)'\s*\})/;

function sectionProblems(slug: string, source: string, kind: EvidenceKind = "case-study"): string[] {
  if (!isWritten(source)) return [];
  const { dir, noun } = COLLECTION[kind];
  const expected = sectionsOf(kind).map((section) => section.id);
  const tags = [...source.matchAll(/<Section\b[^>]*>/g)].map(([tag]) => tag);
  const names = tags.map((tag) => {
    const match = tag.match(SECTION_NAME);
    return match ? (match[1] ?? match[2] ?? match[3] ?? match[4]) : undefined;
  });
  const problems: string[] = [];
  if (names.includes(undefined)) problems.push(`${dir}: "${slug}" has a <Section> with no name="..."`);
  const outside = source.replace(/<Section\b[^>]*>[\s\S]*?<\/Section>/g, "").trim();
  if (outside !== "") problems.push(`${dir}: "${slug}" has content outside a <Section>: "${outside.slice(0, 40)}"`);
  const headings = source.split("\n").filter((line) => /^ {0,3}#{1,6}(\s|$)/.test(line));
  if (headings.length > 0) problems.push(`${dir}: "${slug}" has a Markdown heading ("${headings[0].trim()}"); Section renders each section's only heading`);
  const found = names.filter((name): name is string => name !== undefined);
  if (found.join(",") !== expected.join(",")) {
    problems.push(`${dir}: "${slug}" sections are [${found.join(", ")}]; a written ${noun} needs exactly [${expected.join(", ")}], in that order`);
  }
  return problems;
}

// A kind's committed written list (the proxy and the page both read it)
// against the MDX files that are actually written.
function writtenListProblems(
  listed: readonly string[],
  written: readonly string[],
  order: readonly string[],
  kind: EvidenceKind = "case-study",
): string[] {
  const { dir, list } = COLLECTION[kind];
  const problems = [
    ...written.filter((slug) => !listed.includes(slug)).map((slug) => `${dir}: ${slug}.mdx is written but "${slug}" is not in ${list}`),
    ...listed.filter((slug) => !written.includes(slug)).map((slug) => `${dir}: "${slug}" is in ${list} but ${slug}.mdx is empty`),
    ...[...new Set(listed.filter((slug, i) => listed.indexOf(slug) !== i))].map((slug) => `${dir}: "${slug}" is in ${list} more than once`),
  ];
  if (problems.length === 0 && listed.join(",") !== order.filter((slug) => listed.includes(slug)).join(",")) {
    problems.push(`${dir}: ${list} is not in collection order`);
  }
  return problems;
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
// digital-governance-board: Shahrouz supplied its sentence on 2026-10-12; it states no figure.
const REVIEWED_UNQUALIFIED = ["career-application-system", "digital-governance-board", "this-website"];

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

// Claim dates are written in Sydney time, so today is the Sydney date. The
// UTC date runs a day behind until 10 or 11am in Sydney, and would read a
// claim dated today as a claim from the future.
const CLAIM_TIME_ZONE = "Australia/Sydney";
const sydneyDate = (at: Date): string => new Intl.DateTimeFormat("en-CA", { timeZone: CLAIM_TIME_ZONE }).format(at);

// Every ISO date (YYYY-MM-DD) in a headline metric's value or qualifier that
// is more than DATED_CLAIM_MAX_DAYS before today's Sydney date, counted in
// whole days, or that is not a real calendar date, or that is after today.
function staleClaimProblems(items: readonly EvidenceItem[], today: Date): string[] {
  const todayUtc = Date.parse(`${sydneyDate(today)}T00:00:00Z`);
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

  test("every written case study holds the five sections in order", () => {
    const problems = caseStudyItems.flatMap((item) =>
      sectionProblems(item.slug, readFileSync(fileURLToPath(new URL(`../content/case-studies/${item.slug}.mdx`, import.meta.url)), "utf8")),
    );
    expect(problems).toEqual([]);
  });

  test("every written project holds the eight sections in order", () => {
    const problems = projectItems.flatMap((item) =>
      sectionProblems(item.slug, readFileSync(fileURLToPath(new URL(`../content/projects/${item.slug}.mdx`, import.meta.url)), "utf8"), "project"),
    );
    expect(problems).toEqual([]);
  });

  test("only a project carries a repository, and each is a public GitHub URL", () => {
    expect(caseStudyItems.filter((item) => item.repository !== undefined).map((item) => item.slug)).toEqual([]);
    for (const item of projectItems) {
      if (item.repository === undefined) continue;
      expect(item.repository, item.slug).toMatch(/^https:\/\/github\.com\/shahrouzmohaghegh\/[a-z0-9-]+$/);
    }
  });

  test("the reviewed repositories: PR-1 and PR-2 have one, PR-3 has none", () => {
    expect(Object.fromEntries(projectItems.map((item) => [item.slug, item.repository]))).toEqual({
      "career-application-system": "https://github.com/shahrouzmohaghegh/career-application-system",
      "this-website": "https://github.com/shahrouzmohaghegh/shahrouz-portfolio",
      "platform-modernisation": undefined,
    });
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

  test("CAPABILITY_NAME gives every capability its full name, and nothing else", () => {
    expect(Object.keys(CAPABILITY_NAME)).toEqual([...CAPABILITIES]);
    expect(Object.values(CAPABILITY_NAME)).toEqual([
      "Engineering Leadership",
      "AI-Native Engineering",
      "Executive and Stakeholder Influence",
      "Hands-On Engineering",
    ]);
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

  test("every gate step in ci.yml is classified as setup or a check", () => {
    expect(classifySteps(gateStepNames(readFileSync(CI_PATH, "utf8"))).problems).toEqual([]);
  });

  test("this website's check count matches the gate in ci.yml", () => {
    const value = projectItems.find((item) => item.slug === "this-website")?.headlineMetric.value ?? "";
    const { checks } = classifySteps(gateStepNames(readFileSync(CI_PATH, "utf8")));
    expect(
      value.startsWith(`${COUNT_WORDS[checks.length]} automated checks`),
      `The this-website Headline Metric must open with "${COUNT_WORDS[checks.length]} automated checks": the gate runs ${checks.length} (${checks.join(", ")}).`,
    ).toBe(true);
  });

  test("the display order is the reviewed one", () => {
    expect(
      evidenceItems.map((item) => item.slug),
      "Order in content/*/index.ts is display order. Confirm a reorder, an addition or a removal by updating DISPLAY_ORDER in lib/evidence.test.ts.",
    ).toEqual(DISPLAY_ORDER);
  });
});

// The five case-study sections (Story 3.2): one list, read by the Section
// component, the rail and the integrity check.
describe("the case-study sections", () => {
  test("are context, decisions, actions, outcome and lessons, each with its label", () => {
    expect(CASE_STUDY_SECTIONS).toEqual([
      { id: "context", label: "Context" },
      { id: "decisions", label: "Decisions" },
      { id: "actions", label: "Actions" },
      { id: "outcome", label: "Outcome" },
      { id: "lessons", label: "Lessons" },
    ]);
  });
});

// The eight project sections (Story 3.5), under the three rail group
// headers: one list, read by the Section component, the rail and the
// integrity check.
describe("the project sections", () => {
  test("are the eight sections in order, each with its label", () => {
    expect(PROJECT_SECTIONS).toEqual([
      { id: "problem", label: "Problem" },
      { id: "approach", label: "Approach" },
      { id: "decisions", label: "Decisions" },
      { id: "technologies", label: "Technologies" },
      { id: "tradeoffs", label: "Trade-offs" },
      { id: "testing", label: "Testing" },
      { id: "outcome", label: "Outcome" },
      { id: "lessons", label: "Lessons" },
    ]);
  });

  test("fall under The build, How it held up and What came of it", () => {
    expect(PROJECT_SECTION_GROUPS.map((group) => [group.label, group.sections.map((section) => section.id)])).toEqual([
      ["The build", ["problem", "approach", "decisions", "technologies"]],
      ["How it held up", ["tradeoffs", "testing"]],
      ["What came of it", ["outcome", "lessons"]],
    ]);
  });

  test("sectionsOf gives each kind its own list", () => {
    expect(sectionsOf("case-study")).toBe(CASE_STUDY_SECTIONS);
    expect(sectionsOf("project")).toEqual(PROJECT_SECTIONS);
  });

  test("a section both kinds use has the same label in each, so the one Section component serves both", () => {
    for (const section of PROJECT_SECTIONS) {
      const shared = CASE_STUDY_SECTIONS.find((each) => each.id === section.id);
      if (shared !== undefined) expect(shared.label, section.id).toBe(section.label);
    }
  });
});

// A case study gets a page only once its MDX is written (Story 3.2).
describe("written case studies", () => {
  const item = (slug: string): EvidenceItem =>
    ({ ...caseStudyItems[0], slug, href: `/experience/${slug}` }) as EvidenceItem;

  test("an empty or whitespace-only MDX is unwritten", () => {
    expect(isWritten("")).toBe(false);
    expect(isWritten(" \n\t\n")).toBe(false);
    expect(isWritten('<Section name="context">x</Section>')).toBe(true);
  });

  test("the committed written list names exactly the case studies whose MDX is written, in collection order", () => {
    const written = mdxFiles("case-studies")
      .filter((file) => file.endsWith(".mdx"))
      .filter((file) => isWritten(readFileSync(fileURLToPath(new URL(`../content/case-studies/${file}`, import.meta.url)), "utf8")))
      .map((file) => file.slice(0, -".mdx".length));
    expect(
      writtenListProblems(writtenCaseStudySlugs, written, caseStudyItems.map((each) => each.slug)),
      "Update writtenCaseStudySlugs in content/case-studies/index.ts in the same change as the MDX: the proxy 404s every slug not on it.",
    ).toEqual([]);
  });

  test("writtenItems reads the committed list, in collection order", () => {
    expect(writtenItems("case-study").map((each) => each.slug)).toEqual(
      caseStudyItems.filter((each) => writtenCaseStudySlugs.includes(each.slug)).map((each) => each.slug),
    );
  });

  test("a written list that drifts from the MDX files is named", () => {
    const order = ["a", "b", "c"];
    expect(writtenListProblems(["a", "c"], ["c", "a"], order)).toEqual([]);
    expect(writtenListProblems([], ["b"], order)).toEqual(['case-studies: b.mdx is written but "b" is not in writtenCaseStudySlugs']);
    expect(writtenListProblems(["b"], [], order)).toEqual(['case-studies: "b" is in writtenCaseStudySlugs but b.mdx is empty']);
    expect(writtenListProblems(["c", "a"], ["a", "c"], order)).toEqual(["case-studies: writtenCaseStudySlugs is not in collection order"]);
    expect(writtenListProblems(["a", "a"], ["a"], order)).toEqual(['case-studies: "a" is in writtenCaseStudySlugs more than once']);
  });

  test("the next case study is the following written one, wrapping to the first", () => {
    const written = [item("a"), item("b"), item("c")];
    expect(nextWrittenItem(written, "a")?.slug).toBe("b");
    expect(nextWrittenItem(written, "b")?.slug).toBe("c");
    expect(nextWrittenItem(written, "c")?.slug).toBe("a");
  });

  test("there is no next case study when only one is written, or the slug is not written", () => {
    expect(nextWrittenItem([item("a")], "a")).toBeUndefined();
    expect(nextWrittenItem([item("a"), item("b")], "nope")).toBeUndefined();
    expect(nextWrittenItem([], "a")).toBeUndefined();
  });
});

// A project gets a page only once its MDX is written (Story 3.5); Story 3.7
// wrote all three.
describe("written projects", () => {
  test("the committed written list names exactly the projects whose MDX is written, in collection order", () => {
    const written = mdxFiles("projects")
      .filter((file) => file.endsWith(".mdx"))
      .filter((file) => isWritten(readFileSync(fileURLToPath(new URL(`../content/projects/${file}`, import.meta.url)), "utf8")))
      .map((file) => file.slice(0, -".mdx".length));
    expect(
      writtenListProblems(writtenProjectSlugs, written, projectItems.map((each) => each.slug), "project"),
      "Update writtenProjectSlugs in content/projects/index.ts in the same change as the MDX: the proxy 404s every slug not on it.",
    ).toEqual([]);
  });

  test("writtenItems reads the committed list, projects only, in collection order", () => {
    expect(writtenItems("project").map((each) => each.slug)).toEqual(
      projectItems.filter((each) => writtenProjectSlugs.includes(each.slug)).map((each) => each.slug),
    );
    expect(writtenItems("project").every((each) => each.kind === "project")).toBe(true);
    expect(writtenItems("case-study").every((each) => each.kind === "case-study")).toBe(true);
  });

  test("a drifting project list is named with the project list's name", () => {
    expect(writtenListProblems([], ["b"], ["a", "b"], "project")).toEqual(['projects: b.mdx is written but "b" is not in writtenProjectSlugs']);
    expect(writtenListProblems(["b", "a"], ["a", "b"], ["a", "b"], "project")).toEqual(["projects: writtenProjectSlugs is not in collection order"]);
  });
});

// The capability filter (AD-2, AD-3, AD-4, AD-13): lib/evidence.ts alone
// parses, serialises and applies the selection, counts the other listing,
// and writes the title and the state line.
const ALL_SELECTIONS: Capability[][] = Array.from({ length: 2 ** CAPABILITIES.length }, (_, mask) =>
  CAPABILITIES.filter((_, bit) => mask & (2 ** bit)),
);
const KINDS = Object.keys(EVIDENCE_ROUTE) as EvidenceKind[];
const ITEMS_OF: Record<EvidenceKind, readonly EvidenceItem[]> = { "case-study": caseStudyItems, project: projectItems };

describe("reading the capability parameter", () => {
  test.each([
    ["leadership", ["leadership"]],
    ["hands-on,leadership", ["leadership", "hands-on"]],
    ["Hands-On,leadership,leadership,zzz", ["leadership", "hands-on"]],
    ["hands-on%2Cleadership", ["leadership", "hands-on"]],
    ["hands-on%2cLEADERSHIP", ["leadership", "hands-on"]],
    [" ai-native , executive-influence ", ["ai-native", "executive-influence"]],
    ["leadership,,", ["leadership"]],
    ["zzz", []],
    ["zzz,qqq", []],
    ["", []],
    [",", []],
  ])("%j reads as %j", (raw, expected) => {
    expect(parseSelection(raw)).toEqual(expected);
  });

  test("absent is no selection, and a repeated parameter is read as one list", () => {
    expect(parseSelection(undefined)).toEqual([]);
    expect(parseSelection(["hands-on", "leadership"])).toEqual(["leadership", "hands-on"]);
  });

  // scripts/check-links.mts runs on plain Node and cannot import this
  // module, so it mirrors the reader; the two must agree on every input.
  test("the link check's reader agrees with parseSelection", () => {
    expect([...CAPABILITY_SLUGS]).toEqual([...CAPABILITIES]);
    const inputs: string[][] = [
      [],
      [""],
      [","],
      ["zzz"],
      ["leadership"],
      ["Hands-On,leadership,leadership,zzz"],
      ["hands-on%2Cleadership"],
      ["hands-on%2cLEADERSHIP"],
      [" ai-native , executive-influence "],
      ["leadership,,"],
      ["hands-on", "leadership"],
      ["zzz", "AI-NATIVE"],
      ["executive-influence,ai-native,hands-on,leadership"],
    ];
    for (const values of inputs) expect(selectedCapabilities(values), JSON.stringify(values)).toEqual([...parseSelection(values)]);
  });

  test("isListingPath names the two listings, with or without a query or fragment", () => {
    expect(["/experience", "/projects", "/experience?capability=leadership", "/projects#filter-status"].every(isListingPath)).toBe(true);
    expect(["/", "/contact", "/experience/offshore-delivery-turnaround", "/projects/this-website"].some(isListingPath)).toBe(false);
  });

  test("selectionFrom reads the capability parameter and nothing else", () => {
    expect(selectionFrom({ capability: "ai-native", other: "leadership" })).toEqual(["ai-native"]);
    expect(selectionFrom({ capabilities: "ai-native" })).toEqual([]);
    expect(selectionFrom({})).toEqual([]);
    expect(selectionFrom(undefined)).toEqual([]);
  });
});

describe("writing the capability parameter", () => {
  test("canonical: chip order, one comma-separated parameter, omitted when empty", () => {
    expect(serialiseSelection([])).toBe("");
    expect(listingHref("case-study", [])).toBe("/experience");
    expect(listingHref("project", [])).toBe("/projects");
    expect(listingHref("case-study", parseSelection("hands-on,leadership"))).toBe("/experience?capability=leadership,hands-on");
    expect(listingHref("project", [...CAPABILITIES])).toBe("/projects?capability=leadership,ai-native,executive-influence,hands-on");
  });

  test.each(ALL_SELECTIONS.map((selection) => [selection.join(",") || "(none)", selection] as const))(
    "%s round-trips, and every chip href toggles one capability canonically",
    (_name, selection) => {
      for (const kind of KINDS) {
        const href = listingHref(kind, selection);
        expect(href).not.toMatch(/capability=(&|$)|%2C|\[|&capability/i);
        const query = href.split("?")[1] ?? "";
        expect(parseSelection(new URLSearchParams(query).get(CAPABILITY_PARAM) ?? undefined)).toEqual(selection);
        const chips = filterChips(kind, selection);
        expect(chips.map((chip) => chip.capability)).toEqual([...CAPABILITIES]);
        expect(chips.map((chip) => chip.label)).toEqual(["Leadership", "AI-Native", "Executive Influence", "Hands-On"]);
        for (const chip of chips) {
          expect(chip.selected).toBe(selection.includes(chip.capability));
          const toggled = chip.selected ? selection.filter((c) => c !== chip.capability) : CAPABILITIES.filter((c) => c === chip.capability || selection.includes(c));
          expect(chip.href).toBe(`${listingHref(kind, toggled)}#filter-status`);
          expect(chip.href).toBe(filterLinkHref(kind, toggled));
        }
      }
    },
  );

  test("toggling in click order still writes chip order", () => {
    let selection = toggleCapability([], "hands-on");
    selection = toggleCapability(selection, "leadership");
    expect(selection).toEqual(["leadership", "hands-on"]);
    expect(toggleCapability(selection, "hands-on")).toEqual(["leadership"]);
  });
});

describe("the filter predicate", () => {
  test("nothing selected shows every item", () => {
    for (const kind of KINDS) expect(filterItems(ITEMS_OF[kind], [])).toEqual(ITEMS_OF[kind]);
  });

  // Every one-, two-, three- and four-capability selection is the union of
  // its single-capability results, in collection order.
  test.each(ALL_SELECTIONS.filter((s) => s.length > 0).map((selection) => [selection.join(","), selection] as const))(
    "%s is the union of its capabilities",
    (_name, selection) => {
      for (const kind of KINDS) {
        const union = ITEMS_OF[kind].filter((item) => selection.some((c) => filterItems(ITEMS_OF[kind], [c]).includes(item)));
        expect(filterItems(ITEMS_OF[kind], selection)).toEqual(union);
        for (const item of filterItems(ITEMS_OF[kind], selection)) expect(matchesSelection(item, selection)).toBe(true);
      }
    },
  );

  test("deselecting widens the set again", () => {
    const two = filterItems(caseStudyItems, ["leadership", "ai-native"]);
    const one = filterItems(caseStudyItems, ["leadership"]);
    expect(two.length).toBeGreaterThan(one.length);
    expect(filterItems(caseStudyItems, toggleCapability(["leadership"], "leadership"))).toEqual(caseStudyItems);
  });

  // The launch content (spec, Decisions: empty is a launch path).
  test("at launch, Hands-On matches no case study, and Leadership or Executive Influence no project", () => {
    expect(filterItems(caseStudyItems, ["hands-on"])).toEqual([]);
    expect(filterItems(projectItems, ["leadership"])).toEqual([]);
    expect(filterItems(projectItems, ["executive-influence"])).toEqual([]);
    expect(filterItems(projectItems, ["leadership", "executive-influence"])).toEqual([]);
  });
});

// Each listing's empty-state prose explains why particular capabilities
// have nothing there. It must name exactly the single capabilities that
// are empty on that listing, so a content change cannot leave it stale.
describe("the empty-state prose", () => {
  const MENTION: Record<Capability, RegExp> = {
    leadership: /\bleadership\b/i,
    "ai-native": /\bai-native\b/i,
    "executive-influence": /\b(stakeholder|executive) influence\b/i,
    "hands-on": /\bhands-on\b/i,
  };
  test.each([
    ["case-study", experience.empty],
    ["project", projectsPage.empty],
  ] as const)("on the %s listing it names exactly the capabilities with no match there", (kind, prose) => {
    const empty = CAPABILITIES.filter((capability) => filterItems(ITEMS_OF[kind], [capability]).length === 0);
    const named = CAPABILITIES.filter((capability) => MENTION[capability].test(prose));
    expect(named).toEqual(empty);
  });
});

describe("the cross-listing count", () => {
  test("counts the other listing for the whole selection and carries the selection there", () => {
    for (const kind of KINDS) {
      for (const selection of ALL_SELECTIONS) {
        const other = OTHER_KIND[kind];
        const count = filterItems(ITEMS_OF[other], selection).length;
        const link = crossListing(kind, selection);
        if (count === 0) {
          expect(link).toBeUndefined();
          continue;
        }
        expect(link?.kind).toBe(other);
        expect(link?.count).toBe(count);
        expect(link?.href).toBe(`${listingHref(other, selection)}#filter-status`);
      }
    }
  });

  test("Hands-On on /experience leads to Projects", () => {
    const count = projectItems.filter((item) => item.capabilities.includes("hands-on")).length;
    expect(crossListing("case-study", ["hands-on"])).toEqual({
      kind: "project",
      count,
      href: "/projects?capability=hands-on#filter-status",
      prefix: `${count} Projects`,
      rest: " also match Hands-On Engineering",
    });
  });

  test("the sentence: singular, several names, and unfiltered", () => {
    expect(crossListing("project", ["leadership"])).toMatchObject({ prefix: "1 case study", rest: " also matches Engineering Leadership" });
    expect(crossListing("project", ["leadership", "executive-influence"])).toMatchObject({
      prefix: "2 case studies",
      rest: " also match Engineering Leadership or Executive and Stakeholder Influence",
    });
    expect(crossListing("case-study", [])).toMatchObject({ href: "/projects#filter-status", prefix: `${projectItems.length} Projects`, rest: " are listed separately" });
    expect(crossListing("project", [])).toMatchObject({ href: "/experience#filter-status", rest: " are listed separately" });
  });
});

// AD-3: four states only, the suffix added once by the root template, and
// a distinct title for every distinct state.
describe("the listing title", () => {
  test.each([
    ["case-study", "Experience"],
    ["project", "Projects"],
  ] as const)("unfiltered, the %s listing is titled %s", (kind, title) => {
    expect(listingTitle(kind)).toBe(title);
    expect(listingTitle(kind, [])).toBe(title);
    expect(listingTitle(kind, parseSelection("zzz"))).toBe(title);
  });

  test("the four states, word for word", () => {
    expect(listingTitle("case-study", ["executive-influence"])).toBe("Experience, 1 of 3 case studies, Executive and Stakeholder Influence");
    expect(listingTitle("case-study", ["leadership", "ai-native"])).toBe(
      "Experience, 2 of 3 case studies, Engineering Leadership or AI-Native Engineering",
    );
    expect(listingTitle("project", ["executive-influence"])).toBe("Projects, no projects match, Executive and Stakeholder Influence");
    expect(listingTitle("case-study", ["hands-on"])).toBe("Experience, no case studies match, Hands-On Engineering");
    expect(listingTitle("case-study", ["leadership", "ai-native", "executive-influence"])).toBe(
      "Experience, 3 of 3 case studies, Engineering Leadership or AI-Native Engineering or Executive and Stakeholder Influence",
    );
  });

  test("the noun is singular when the count is one", () => {
    const one = caseStudyItems.slice(0, 1);
    expect(listingTitle("case-study", [...one[0].capabilities], one)).toBe(`Experience, 1 of 1 case study, ${CAPABILITY_NAME[one[0].capabilities[0]]}`);
  });

  test("every reachable state on both listings has a distinct title, with no suffix, no and, and full names only", () => {
    const titles = KINDS.flatMap((kind) => ALL_SELECTIONS.map((selection) => listingTitle(kind, selection)));
    expect(new Set(titles).size).toBe(titles.length);
    for (const title of titles) {
      expect(title).not.toMatch(/Shahrouz|\||\band\b(?! Stakeholder)/);
      expect(title).not.toMatch(/\u2014/);
    }
    for (const selection of ALL_SELECTIONS.filter((s) => s.length > 0)) {
      for (const kind of KINDS) {
        for (const c of selection) expect(listingTitle(kind, selection)).toContain(CAPABILITY_NAME[c]);
      }
    }
  });
});

describe("the state line", () => {
  test.each([
    [[], { emphasis: "Showing all 3 case studies.", rest: " No capability filter applied." }],
    [["executive-influence"], { emphasis: "Showing 1 of 3 case studies", rest: ", filtered by Executive and Stakeholder Influence." }],
    [["leadership", "ai-native"], { emphasis: "Showing 2 of 3 case studies", rest: ", filtered by Engineering Leadership or AI-Native Engineering." }],
    [
      ["leadership", "ai-native", "executive-influence"],
      { emphasis: "Showing 3 of 3 case studies", rest: ", filtered by Engineering Leadership, AI-Native Engineering or Executive and Stakeholder Influence." },
    ],
    [["hands-on"], { emphasis: "Showing 0 of 3 case studies", rest: ", filtered by Hands-On Engineering." }],
  ] as Array<[Capability[], { emphasis: string; rest: string }]>)("on /experience, %j", (selection, expected) => {
    expect(stateLine("case-study", selection)).toEqual(expected);
  });

  test("on /projects it says projects, and project for one", () => {
    expect(stateLine("project", [])).toEqual({ emphasis: "Showing all 3 projects.", rest: " No capability filter applied." });
    expect(stateLine("project", ["ai-native"]).emphasis).toBe("Showing 1 of 3 projects");
    expect(stateLine("project", [], projectItems.slice(0, 1)).emphasis).toBe("Showing all 1 project.");
  });

  test("the title and the state line name a selection with the same joiner, in the same order", () => {
    for (const selection of ALL_SELECTIONS.filter((s) => s.length > 0)) {
      const names = joinCapabilityNames(selection);
      expect(stateLine("case-study", selection).rest).toBe(`, filtered by ${names}.`);
      expect(listingTitle("case-study", selection).endsWith(joinCapabilityNames(selection, " or "))).toBe(true);
      if (selection.length <= 2) expect(joinCapabilityNames(selection, " or ")).toBe(names);
    }
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

  test("a gate step in neither list is named, and is not counted as a check", () => {
    const { checks, problems } = classifySteps([...SETUP_STEPS, "Install browsers", ...CHECK_STEPS]);
    expect(checks).toEqual(CHECK_STEPS);
    expect(problems).toEqual([
      `${CI_PATH}: gate step "Install browsers" is neither setup nor a check; add it to SETUP_STEPS or CHECK_STEPS in lib/evidence.test.ts`,
    ]);
  });

  test("a listed step missing from the gate is named, and the count drops with it", () => {
    const { checks, problems } = classifySteps([...SETUP_STEPS, ...CHECK_STEPS.filter((step) => step !== "Lint")]);
    expect(checks).toHaveLength(CHECK_STEPS.length - 1);
    expect(problems).toEqual([`lib/evidence.test.ts lists "Lint", which is not a gate step in ${CI_PATH}`]);
  });

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

  const section = (name: string) => `<Section name="${name}">\n\nProse.\n\n</Section>`;
  const fiveSections = ["context", "decisions", "actions", "outcome", "lessons"].map(section).join("\n\n");

  test("a written case study with the five sections in order passes, and an empty one is not checked", () => {
    expect(sectionProblems("x", fiveSections)).toEqual([]);
    expect(sectionProblems("x", "")).toEqual([]);
    expect(sectionProblems("x", "\n  \n")).toEqual([]);
  });

  test.each([
    ["a missing section", ["context", "decisions", "actions", "outcome"]],
    ["an extra section", ["context", "decisions", "actions", "outcome", "lessons", "appendix"]],
    ["a repeated section", ["context", "decisions", "decisions", "actions", "outcome", "lessons"]],
    ["sections out of order", ["context", "actions", "decisions", "outcome", "lessons"]],
  ])("%s is named, with the slug", (_label, names) => {
    const problems = sectionProblems("x", names.map(section).join("\n\n"));
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('"x" sections are');
    expect(problems[0]).toContain("[context, decisions, actions, outcome, lessons]");
  });

  test("single-quoted and braced string names count as names", () => {
    const names = ["context", "decisions", "actions", "outcome", "lessons"];
    const forms = [(n: string) => `name='${n}'`, (n: string) => `name={"${n}"}`, (n: string) => `name={ '${n}' }`];
    for (const form of forms) {
      const source = names.map((n) => `<Section ${form(n)}>\n\nProse.\n\n</Section>`).join("\n\n");
      expect(sectionProblems("x", source), form("context")).toEqual([]);
    }
  });

  test("prose with no section at all is named twice: the sections and the stray content", () => {
    const problems = sectionProblems("x", "Just prose.");
    expect(problems).toEqual([
      'case-studies: "x" has content outside a <Section>: "Just prose."',
      'case-studies: "x" sections are []; a written case study needs exactly [context, decisions, actions, outcome, lessons], in that order',
    ]);
  });

  test("content outside the sections is named, with the slug", () => {
    expect(sectionProblems("x", `Intro line.\n\n${fiveSections}`)).toEqual(['case-studies: "x" has content outside a <Section>: "Intro line."']);
    expect(sectionProblems("x", `${fiveSections}\n\nA closing word.`)).toEqual([
      'case-studies: "x" has content outside a <Section>: "A closing word."',
    ]);
  });

  test.each([
    ["inside a section", `<Section name="context">\n\n## Background\n\nProse.\n\n</Section>`],
    ["a level-six heading", `<Section name="context">\n\n###### Small\n\n</Section>`],
  ])("a Markdown heading %s is named, with the slug", (_label, first) => {
    const source = [first, ...["decisions", "actions", "outcome", "lessons"].map(section)].join("\n\n");
    const problems = sectionProblems("x", source);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/^case-studies: "x" has a Markdown heading \("#+ \w+"\)/);
  });

  test("a hash that is not a heading passes", () => {
    const source = fiveSections.replace("Prose.", "Issue #12 and #hashtag, mid-line.");
    expect(sectionProblems("x", source)).toEqual([]);
  });

  test("a section with no name is named", () => {
    expect(sectionProblems("x", `<Section>\n\nProse.\n\n</Section>\n\n${fiveSections}`)).toEqual([
      'case-studies: "x" has a <Section> with no name="..."',
    ]);
  });

  const eightSections = ["problem", "approach", "decisions", "technologies", "tradeoffs", "testing", "outcome", "lessons"];

  test("a written project with the eight sections in order passes, and an empty one is not checked", () => {
    expect(sectionProblems("x", eightSections.map(section).join("\n\n"), "project")).toEqual([]);
    expect(sectionProblems("x", "", "project")).toEqual([]);
  });

  test.each([
    ["a missing section", eightSections.filter((name) => name !== "testing")],
    ["an extra section", [...eightSections, "appendix"]],
    ["sections out of order", ["approach", "problem", ...eightSections.slice(2)]],
    ["the case-study sections", ["context", "decisions", "actions", "outcome", "lessons"]],
  ])("a project with %s is named, with the slug", (_label, names) => {
    const problems = sectionProblems("x", names.map(section).join("\n\n"), "project");
    expect(problems).toEqual([
      `projects: "x" sections are [${names.join(", ")}]; a written project needs exactly [${eightSections.join(", ")}], in that order`,
    ]);
  });

  test("a case study with the project sections is named", () => {
    expect(sectionProblems("x", eightSections.map(section).join("\n\n"))).toHaveLength(1);
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

  test("today is the Sydney date, so a claim dated this morning in Sydney is not in the future", () => {
    // 7am on 10 October in Sydney (AEDT, UTC+11) is still 9 October in UTC.
    const sydneyMorning = new Date("2026-10-09T20:00:00Z");
    const dated = (value: string) => item({ headlineMetric: { value, qualifier: "in one place" } });
    expect(staleClaimProblems([dated("On 2026-10-10")], sydneyMorning)).toEqual([]);
    expect(staleClaimProblems([dated("On 2026-10-11")], sydneyMorning)).toEqual(['"x": headline metric date 2026-10-11 is in the future']);
    expect(staleClaimProblems([dated("Audited clean on 2025-10-10")], sydneyMorning)).toEqual([]);
    expect(staleClaimProblems([dated("Audited clean on 2025-10-09")], sydneyMorning)).toHaveLength(1);
    // 9am on 1 July in Sydney (AEST, UTC+10) is still 30 June in UTC.
    expect(staleClaimProblems([dated("On 2026-07-01")], new Date("2026-06-30T23:00:00Z"))).toEqual([]);
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
