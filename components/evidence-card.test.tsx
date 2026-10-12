// {components.evidence-card} (Story 2.6; reused by Epic 3's listings).
// Renders the card to static markup and checks, top to bottom: one eyebrow
// per capability in full-name form and canonical order, an h3 whose whole
// text is the link, the metric with its qualifier as one sentence (or the
// value alone when no qualifier is required, with no stray separator), the
// summary, then the CTA to the same href. The title's level, h2 or h3, is
// the surface's choice (headingLevel); the suite renders h3 unless a test
// passes 2. The card reads only EvidenceItem through lib/evidence and never
// imports content/.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";

import { caseStudyItems, inCanonicalOrder, type EvidenceItem } from "@/lib/evidence";
import { EvidenceCard, cardTitleId } from "./evidence-card";
import styles from "./evidence-card.module.css";

const CTA = "Read the case study";

const QUALIFIED: EvidenceItem = {
  slug: "sample-qualified",
  kind: "case-study",
  title: "A sample case study",
  summary: "One line on what changed and why.",
  capabilities: ["leadership"],
  headlineMetric: { value: "Lead time down 50%", qualifier: "across two teams" },
  href: "/experience/sample-qualified",
};

const UNQUALIFIED: EvidenceItem = {
  slug: "sample-unqualified",
  kind: "project",
  title: "A sample project",
  summary: "One line on what it does.",
  // Declared out of order: the card shows what lib/evidence exposes.
  capabilities: inCanonicalOrder(["hands-on", "ai-native"]),
  headlineMetric: { value: "Open source", qualifierNotRequired: true },
  href: "/projects/sample-unqualified",
};

const render = (item: EvidenceItem, headingLevel: 2 | 3 = 3): string =>
  renderToStaticMarkup(<EvidenceCard item={item} ctaLabel={CTA} headingLevel={headingLevel} />);
const textOf = (fragment: string): string => fragment.replace(/<[^>]*>/g, "").replace(/&#x27;/g, "'").replace(/&amp;/g, "&");
const classOf = (cls: string): RegExp => new RegExp(`class="${cls}"`);
// The opening tag and text of every element carrying the class, in order.
const byClass = (html: string, cls: string): string[] =>
  [...html.matchAll(new RegExp(`<(\\w+)[^>]*class="${cls}"[^>]*>([\\s\\S]*?)</\\1>`, "g"))].map((m) => textOf(m[2]));

describe("the evidence card", () => {
  test("renders eyebrow, linked h3 title, metric, summary and CTA, in that order", () => {
    const html = render(QUALIFIED);
    expect(html.startsWith("<article"), "the card is an article").toBe(true);
    const order = [
      html.search(classOf(styles.eyebrow)),
      html.indexOf("<h3"),
      html.search(classOf(styles.metric)),
      html.search(classOf(styles.summary)),
      html.search(classOf(styles.cta)),
    ];
    expect(order.every((at) => at > -1), `every part renders: ${order.join(", ")}`).toBe(true);
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });

  test("the whole h3 text is one link to the item's href", () => {
    const html = render(QUALIFIED);
    const h3 = html.match(/<h3[^>]*>([\s\S]*?)<\/h3>/)?.[1] ?? "";
    expect(h3).toMatch(new RegExp(`^<a [^>]*href="${QUALIFIED.href}"[^>]*>${QUALIFIED.title}</a>$`));
  });

  test.each([2, 3] as const)("headingLevel %i renders the title as that heading, and no other", (level) => {
    const html = render(QUALIFIED, level);
    const headings = [...html.matchAll(/<(h[1-6])[^>]*>([\s\S]*?)<\/\1>/g)];
    expect(headings.map((m) => m[1])).toEqual([`h${level}`]);
    expect(headings[0][2]).toMatch(new RegExp(`^<a [^>]*id="${cardTitleId(QUALIFIED.slug)}"[^>]*href="${QUALIFIED.href}"[^>]*>${QUALIFIED.title}</a>$`));
    expect(headings[0][0], "the title keeps its styles at either level").toContain(`class="${styles.title}"`);
  });

  test("the CTA links to the same href as the title", () => {
    const html = render(QUALIFIED);
    const hrefs = [...html.matchAll(/<a [^>]*href="([^"]*)"/g)].map((m) => m[1]);
    expect(hrefs).toEqual([QUALIFIED.href, QUALIFIED.href]);
    expect(byClass(html, styles.cta)).toEqual([CTA]);
  });

  test("the CTA is described by the title link, whose id comes from the slug", () => {
    const html = render(QUALIFIED);
    const id = cardTitleId(QUALIFIED.slug);
    expect(id).toContain(QUALIFIED.slug);
    const links = [...html.matchAll(/<a [^>]*>/g)].map((m) => m[0]);
    expect(links[0], "the title link carries the id").toContain(`id="${id}"`);
    expect(links[1], "the CTA points at it").toContain(`aria-describedby="${id}"`);
    expect(html.split(`id="${id}"`)).toHaveLength(2);
    expect(cardTitleId(UNQUALIFIED.slug)).not.toBe(id);
  });

  test("the metric and its qualifier read as one sentence", () => {
    expect(byClass(render(QUALIFIED), styles.metric)).toEqual(["Lead time down 50% across two teams"]);
  });

  test("a metric that needs no qualifier shows the value alone, with no stray separator", () => {
    expect(byClass(render(UNQUALIFIED), styles.metric)).toEqual(["Open source"]);
  });

  test("one eyebrow per capability, in full-name form and canonical order", () => {
    expect(byClass(render(QUALIFIED), styles.eyebrow)).toEqual(["Engineering Leadership"]);
    expect(byClass(render(UNQUALIFIED), styles.eyebrow)).toEqual(["AI-Native Engineering", "Hands-On Engineering"]);
  });

  test("the summary renders as written", () => {
    expect(byClass(render(QUALIFIED), styles.summary)).toEqual([QUALIFIED.summary]);
  });

  test("no image and no third link", () => {
    const html = render(QUALIFIED);
    expect(html).not.toMatch(/<img|<svg|<picture/);
    expect(html.match(/<a /g)).toHaveLength(2);
  });

  test("every real case study renders, naming the item on failure", () => {
    for (const item of caseStudyItems) {
      const html = render(item);
      expect(html, item.slug).toContain(`href="${item.href}"`);
      expect(byClass(html, styles.metric)[0], item.slug).toContain(item.headlineMetric.value);
    }
  });

  test("the card imports nothing from content/, and evidence only through lib/evidence", () => {
    const source = readFileSync(join(process.cwd(), "components/evidence-card.tsx"), "utf8");
    const specifiers = [...source.matchAll(/\bfrom\s*["']([^"']+)["']|\bimport\s*["']([^"']+)["']/g)].map((m) => m[1] ?? m[2]);
    expect(specifiers.filter((s) => /(^|\/)content(\/|$)/.test(s))).toEqual([]);
    expect(specifiers.filter((s) => /evidence-types/.test(s))).toEqual([]);
    expect(specifiers).toContain("@/lib/evidence");
  });
});
