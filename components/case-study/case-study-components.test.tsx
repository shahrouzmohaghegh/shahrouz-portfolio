// The case-study content components (Story 3.3): facts strip, outcome band,
// key-value list, source note and trade-off pair, and Story 3.4's retrieval
// diagram. Each is rendered to static markup, which is what a visitor with
// JavaScript off gets, and checked for its structure and the rule it exists
// to enforce: the outcome band's figure and qualifier are one sentence and a
// bare figure fails, the source note states an instrument and a weakness,
// the trade-off pair labels both sides in words, and the diagram carries
// every distinction in words. The CSS checks pin what markup cannot show: the
// on-deep focus ring, the 2px ink rule on costs and no accent anywhere. Real
// MDX bodies are rendered through these components in
// app/experience/[slug]/case-study.test.tsx.

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";

import { caseStudyPage } from "@/content/case-study-page";
import { retrievalDiagram, type Candidate } from "@/content/retrieval-diagram";
import { figureRole } from "@/lib/figure-role";
import { useMDXComponents } from "@/mdx-components";
import { FactsStrip } from "./facts-strip";
import { KeyValueList } from "./key-value-list";
import { OutcomeBand } from "./outcome-band";
import { RetrievalDiagram } from "./retrieval-diagram";
import { SourceNote } from "./source-note";
import { TradeoffList, TradeoffPair } from "./tradeoff-pair";

const DIR = "components/case-study";
const css = (name: string): string => readFileSync(join(process.cwd(), DIR, `${name}.module.css`), "utf8");
const decode = (s: string): string =>
  s.replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
const text = (html: string): string => decode(html.replace(/<[^>]*>/g, "")).replace(/\s+/g, " ").trim();
// The declarations of the rule whose whole selector is `selector`, not a
// selector list that merely ends with it.
const rule = (sheet: string, selector: string): string => {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = [...sheet.matchAll(new RegExp(`(^|\\n)${escaped}\\s*\\{([^}]*)\\}`, "g"))].find(
    (m) => !sheet.slice(0, m.index).trimEnd().endsWith(","),
  );
  expect(match, `${selector} rule`).toBeDefined();
  return match?.[2] ?? "";
};
// Text with block boundaries kept as spaces.
const words = (html: string): string => decode(html.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();

describe("FactsStrip", () => {
  const html = renderToStaticMarkup(
    <FactsStrip
      facts={[
        { term: "Function", value: "A team across two sites" },
        { term: "Span", value: "Two managers" },
      ]}
    />,
  );

  test("is one definition list, each fact a div holding one dt then one dd", () => {
    expect(html.startsWith("<dl")).toBe(true);
    const facts = [...html.matchAll(/<div[^>]*><dt[^>]*>([^<]*)<\/dt><dd[^>]*>([^<]*)<\/dd><\/div>/g)].map((m) => [m[1], m[2]]);
    expect(facts).toEqual([
      ["Function", "A team across two sites"],
      ["Span", "Two managers"],
    ]);
  });

  test("an empty strip, or a fact with no value, fails", () => {
    expect(() => renderToStaticMarkup(<FactsStrip facts={[]} />)).toThrow(/at least one fact/);
    expect(() => renderToStaticMarkup(<FactsStrip facts={[{ term: "Term", value: " " }]} />)).toThrow(/term and a value/);
  });

  test("wraps its facts onto rows when the column is narrow", () => {
    expect(rule(css("facts-strip"), ".strip")).toContain("grid-template-columns: var(--component-facts-strip-columns);");
  });
});

describe("OutcomeBand", () => {
  const render = (qualifier: string, figure = "Lead time down 50%") =>
    renderToStaticMarkup(<OutcomeBand tag="Lead time" figure={figure} qualifier={qualifier} />);

  test("renders the tag, then the figure and its qualifier as one sentence in one paragraph", () => {
    const html = render("across two teams, measured from the delivery workflow.");
    const paragraphs = [...html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/g)].map((m) => text(m[1]));
    expect(paragraphs).toEqual(["Lead time", "Lead time down 50% across two teams, measured from the delivery workflow."]);
  });

  test("sets the figure in the role Figure demotion gives its length", () => {
    for (const figure of ["Two years", "Bad fixes cut by more than 80%"]) {
      const html = render("on one team, by one measure.", figure);
      expect(html).toContain(`data-figure-role="${figureRole(figure)}">${figure}</span>`);
    }
  });

  test("a figure without a qualifier sentence fails, at the type and at render", () => {
    // @ts-expect-error The qualifier is required: a bare figure cannot ship (FR-34).
    expect(() => renderToStaticMarkup(<OutcomeBand tag="Lead time" figure="Lead time down 50%" />)).toThrow();
    expect(() => render("")).toThrow(/qualifier/);
    expect(() => render("Across two teams.")).toThrow(/qualifier/);
    expect(() => render("across two teams")).toThrow(/qualifier/);
    expect(() => render("across two teams.", "Lead time down 50%.")).toThrow(/figure/);
  });

  test("its deep ground sets the on-deep focus ring, so a link inside it draws that ring", () => {
    const band = rule(css("outcome-band"), ".band");
    expect(band).toMatch(/--focus-ring:\s*var\(--color-focus-ring-on-deep\);/);
    expect(band).toMatch(/background:\s*var\(--color-deep\);/);
    const html = renderToStaticMarkup(
      <OutcomeBand tag="Lead time" figure="Lead time down 50%" qualifier="across two teams.">
        <a href="#source">Source</a>
      </OutcomeBand>,
    );
    expect(html).toMatch(/^<div class="[^"]*"><p[\s\S]*<a href="#source">Source<\/a><\/div>$/);
  });

  test("sits in the body column, not full bleed", () => {
    expect(rule(css("outcome-band"), ".band")).not.toMatch(/100vw|margin-inline:\s*calc|position:\s*absolute/);
  });
});

describe("KeyValueList", () => {
  test("is one definition list of rows, each a key then its value", () => {
    const html = renderToStaticMarkup(<KeyValueList rows={[{ term: "Lead time", value: "Down 50% across two teams" }]} />);
    expect(html).toMatch(/^<dl[^>]*><div[^>]*><dt[^>]*>Lead time<\/dt><dd[^>]*>Down 50% across two teams<\/dd><\/div><\/dl>$/);
  });

  test("an empty list fails", () => {
    expect(() => renderToStaticMarkup(<KeyValueList rows={[]} />)).toThrow(/at least one row/);
  });

  test("values use tabular figures", () => {
    expect(rule(css("key-value-list"), ".value")).toContain("font-variant-numeric: tabular-nums;");
  });
});

describe("SourceNote", () => {
  test("states the instrument, then its weakness, in one muted paragraph", () => {
    const html = renderToStaticMarkup(<SourceNote instrument="Counted from the workflow." weakness="It misses unlinked work." />);
    expect(html).toMatch(/^<p class="[^"]*">Counted from the workflow\. It misses unlinked work\.<\/p>$/);
    expect(rule(css("source-note"), ".note")).toMatch(/color:\s*var\(--color-muted\);/);
  });

  test("a missing instrument or weakness fails", () => {
    expect(() => renderToStaticMarkup(<SourceNote instrument="Counted from the workflow." weakness="" />)).toThrow(/weakness/);
    expect(() => renderToStaticMarkup(<SourceNote instrument="" weakness="It misses unlinked work." />)).toThrow(/instrument/);
  });
});

describe("TradeoffPair", () => {
  const html = renderToStaticMarkup(
    <TradeoffList>
      <TradeoffPair decision="Write checks, not guidance." buys="A defect class stops recurring." costs="Each check is code to keep." />
    </TradeoffList>,
  );

  test("is a list item: the decision as h3, then What it buys, then What it costs, each labelled in words", () => {
    expect(html).toMatch(/^<ol[^>]*><li[^>]*><h3[^>]*>Write checks, not guidance\.<\/h3>/);
    const sides = [...html.matchAll(/<div class="[^"]*"><p[^>]*>([^<]*)<\/p><p[^>]*>([^<]*)<\/p><\/div>/g)].map((m) => [m[1], m[2]]);
    expect(sides).toEqual([
      ["What it buys", "A defect class stops recurring."],
      ["What it costs", "Each check is code to keep."],
    ]);
    expect(caseStudyPage.tradeoff).toEqual({ buys: "What it buys", costs: "What it costs" });
  });

  test("optional reasoning sits between the decision and the pair", () => {
    const withWhy = renderToStaticMarkup(
      <TradeoffPair decision="Decide." buys="Buys." costs="Costs.">
        Because.
      </TradeoffPair>,
    );
    expect(words(withWhy)).toBe(`Decide. Because. ${caseStudyPage.tradeoff.buys} Buys. ${caseStudyPage.tradeoff.costs} Costs.`);
  });

  test("an empty side fails", () => {
    expect(() => renderToStaticMarkup(<TradeoffPair decision="Decide." buys="Buys." costs=" " />)).toThrow(/costs/);
  });

  test("costs sit under a 2px ink rule, buys under a tone-2 hairline, and the pair stacks below 768px", () => {
    const sheet = css("tradeoff-pair");
    expect(rule(sheet, ".costs")).toContain("border-top: var(--space-rule-card) solid var(--color-ink);");
    expect(rule(sheet, ".buys")).toContain("border-top: var(--space-rule-hairline) solid var(--color-tone-2);");
    expect(rule(sheet, ".pair")).toContain("grid-template-columns: var(--component-tradeoff-pair-columns);");
  });
});

// Story 3.4 (FR-36): the original diagram of how the retrieval layer decides.
// One question in two states, both candidates through three gates in each,
// and the answer inverts when only the calendar moves. Every distinction is
// in words (NFR-2); glyphs are decorative; no table semantics anywhere.
describe("RetrievalDiagram", () => {
  const html = renderToStaticMarkup(<RetrievalDiagram />);
  const { states, gates } = retrievalDiagram;
  // Each state's markup: from its h3 to the next h3, or to the similarity line.
  const stateBlocks = html.split(/(?=<h3[\s>])/).slice(1);
  const answerOf = (block: string): string => text(block.match(/<p class="[^"]*"><strong[^>]*>Answer:<\/strong>([\s\S]*?)<\/p>/)?.[1] ?? "");

  test("is one figure whose visible figcaption states the mechanism in full sentences", () => {
    expect(html.match(/<figure[\s>]/g)).toHaveLength(1);
    expect(html).toMatch(/^<figure[^>]*><figcaption[^>]*>/);
    const caption = text(html.match(/<figcaption[^>]*>([\s\S]*?)<\/figcaption>/)?.[1] ?? "");
    expect(caption).toBe(retrievalDiagram.caption);
    expect(caption.split(/(?<=\.)\s+(?=[A-Z])/).length).toBeGreaterThanOrEqual(3);
    // The caption names each gate as its label does.
    for (const word of ["Relevance", "authority", "in-force gate"]) expect(caption).toContain(word);
    expect(html).not.toMatch(/<figcaption[^>]*(hidden|sr-only|visually-hidden)/);
  });

  test("each state is an h3 heading, then a list of the two candidates, then its answer in words", () => {
    expect(stateBlocks).toHaveLength(2);
    stateBlocks.forEach((block, i) => {
      expect(text(block.match(/<h3[^>]*>([\s\S]*?)<\/h3>/)?.[1] ?? "")).toBe(states[i].heading);
      // Unordered, because the candidates' order is not a ranking; role="list"
      // keeps list semantics in Safari once list-style is none.
      expect(block).not.toMatch(/<ol[\s>]/);
      const list = block.match(/<ul role="list"[^>]*>([\s\S]*?)<\/ul>/)?.[1] ?? "";
      expect(list.match(/<li[\s>]/g)).toHaveLength(2);
      expect(block.indexOf("<ul")).toBeLessThan(block.indexOf("Answer:"));
      expect(answerOf(block)).toBe(states[i].answer);
    });
  });

  test("the answer inverts: the exception wins while it applies, the standard once it has expired", () => {
    for (const state of states) expect(state.candidates.filter((c) => c.wins)).toHaveLength(1);
    const winner = (i: number) => states[i].candidates.find((c) => c.wins);
    expect(winner(0)?.name).toMatch(/exception/);
    expect(winner(1)?.name).toMatch(/standard/);
    // Each state's Answer line gives its winner's guidance.
    [0, 1].forEach((i) => {
      expect(answerOf(stateBlocks[i])).toBe(states[i].answer);
      expect(states[i].answer.startsWith((winner(i)?.guidance ?? "-").replace(/\.$/, ""))).toBe(true);
    });
    expect(states[0].answer).not.toBe(states[1].answer);
  });

  test("only the calendar moves: the same two candidates, the same relevance and ranking, and only in force changes", () => {
    const [before, after] = states;
    before.candidates.forEach((c, i) => {
      const d = after.candidates[i];
      expect([d.name, d.guidance, d.relevant, d.authority.mark]).toEqual([c.name, c.guidance, c.relevant, c.authority.mark]);
    });
    expect(before.candidates.map((c) => c.inForce.mark)).toEqual(["pass", "pass"]);
    expect(after.candidates.map((c) => c.inForce.mark)).toEqual(["pass", "fail"]);
  });

  test("every candidate shows its three gates, each a visible word answer, with the glyph aria-hidden", () => {
    const items = [...html.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/g)].map((m) => m[1]);
    expect(items).toHaveLength(4);
    for (const item of items) {
      const rows = [...item.matchAll(/<dt[^>]*>([\s\S]*?)<\/dt><dd[^>]*>([\s\S]*?)<\/dd>/g)];
      expect(rows.map((m) => text(m[1]))).toEqual([gates.relevant, gates.authority, gates.inForce]);
      for (const [, , dd] of rows) {
        const glyph = dd.match(/^<span ([^>]*)>([^<]*)<\/span>/);
        expect(glyph?.[1]).toContain('aria-hidden="true"');
        const answer = text(dd.replace(/^<span[^>]*>[^<]*<\/span>/, ""));
        expect(answer).toMatch(/^(Yes|No|Outranks|Outranked)\b/);
      }
    }
    // Authority says which source outranks which, in words.
    for (const c of states.flatMap((s): readonly Candidate[] => s.candidates)) {
      expect(c.authority.answer).toMatch(c.authority.mark === "outranks" ? /^Outranks the standard$/ : /^Outranked (only )?by the exception/);
    }
    // Once the exception has expired, the winning standard says why its outranker no longer counts.
    expect(states[1].candidates[0].authority.answer).toBe("Outranked only by the exception, which is no longer in force");
  });

  test("each candidate says, in words, whether it is the answer", () => {
    for (const state of states) {
      for (const c of state.candidates) {
        expect(c.verdict).toMatch(c.wins ? /^The answer\./ : /^Not the answer\./);
        expect(html).toContain(`>${c.verdict}</p>`);
      }
    }
  });

  test("one line says what similarity alone would return, in both states", () => {
    expect(html.split(retrievalDiagram.similarityAlone).length - 1).toBe(1);
    expect(retrievalDiagram.similarityAlone).toMatch(/^Similarity alone would rank the temporary exception near the top in both states/);
    expect(html.indexOf(retrievalDiagram.similarityAlone)).toBeGreaterThan(html.lastIndexOf("Answer:"));
  });

  test("no table semantics, no image, no SVG, no script", () => {
    expect(html).not.toMatch(/<table|role="(table|row|cell|grid|gridcell|rowheader|columnheader)"|<svg|<img|<script/);
    const sheet = css("retrieval-diagram");
    expect(sheet).not.toMatch(/display:\s*(table|table-row|table-cell)/);
    expect(sheet).not.toMatch(/animation|transition/);
  });

  test("the words carry no em dash, no figure and no digit", () => {
    const words = JSON.stringify(retrievalDiagram);
    expect(words).not.toMatch(/\u2014/);
    expect(words).not.toMatch(/\d/);
  });

  test("the states stack below 768px and sit side by side when there is room, within the section's measure", () => {
    const sheet = css("retrieval-diagram");
    expect(rule(sheet, ".states")).toContain("grid-template-columns: var(--component-retrieval-diagram-columns);");
    expect(rule(sheet, ".figure")).toContain("max-width: var(--space-measure-body);");
  });
});

describe("how the components are built", () => {
  const sources = readdirSync(join(process.cwd(), DIR)).filter((f) => /\.tsx$/.test(f) && !/\.test\./.test(f));

  test("all of them are handed to every MDX file by mdx-components.tsx", () => {
    const components = useMDXComponents();
    for (const [name, component] of Object.entries({ FactsStrip, OutcomeBand, KeyValueList, SourceNote, TradeoffList, TradeoffPair, RetrievalDiagram })) {
      expect(components[name], name).toBe(component);
    }
  });

  test("each is a server component: no client directive, no island, no evidence collection", () => {
    expect(sources.sort()).toEqual(["facts-strip.tsx", "key-value-list.tsx", "outcome-band.tsx", "retrieval-diagram.tsx", "source-note.tsx", "tradeoff-pair.tsx"]);
    for (const file of sources) {
      const code = readFileSync(join(process.cwd(), DIR, file), "utf8");
      expect(code, file).not.toMatch(/["']use client["']/);
      expect(code, file).not.toMatch(/islands\/|content\/case-studies|content\/projects/);
    }
  });

  test("no stylesheet uses the accent", () => {
    for (const file of readdirSync(join(process.cwd(), DIR)).filter((f) => f.endsWith(".module.css"))) {
      expect(readFileSync(join(process.cwd(), DIR, file), "utf8"), file).not.toMatch(/--color-accent\b/);
    }
  });
});
