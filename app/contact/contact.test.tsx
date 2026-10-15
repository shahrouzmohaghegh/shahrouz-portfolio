// The /contact route (Story 3.8). Renders app/contact/page.tsx to static
// markup, which is what a visitor with JavaScript off gets, and walks the
// spec's matrix: the h1, the line under it and the availability line, then
// the email link and the LinkedIn link in that order, each with its
// sentence, then the statement that there is no CV, and the studio portrait
// on its plate. The route asks for no noindex, carries its own title and
// meta description, is static and reaches no island.
//
// The email is a real mailto: link whose text is the footer's obfuscation
// (components/email-address.tsx), so the address is never one text run. The
// hero sets the on-deep focus ring for both links. The portrait file is read
// chunk by chunk: only IHDR, IDAT and IEND may be present, so no metadata
// is ever served, at its natural 1311 x 1200.
//
// No reply-time promise, no form, no download and no CV document link may
// appear. Banned words come from the untracked .forbidden-terms, as in
// app/home.test.tsx, and a failure names the line, never the term.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";

import { contact } from "@/content/contact";
import { site } from "@/content/site";
import { EmailAddress } from "@/components/email-address";
import { cvDocumentProblem, extractHrefs } from "@/scripts/check-links.mts";
import * as contactModule from "./page";
import { PORTRAIT_SIZES } from "./page";
import styles from "./contact.module.css";

const ContactPage = contactModule.default;

const decode = (s: string): string =>
  s
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
const escapeRegExp = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const source = (path: string): string => readFileSync(join(process.cwd(), path), "utf8");
const specifiers = (code: string): string[] => [...code.matchAll(/^\s*import[^"']*["']([^"']+)["']/gm)].map((m) => m[1]);

const html = renderToStaticMarkup(<>{ContactPage() as ReactNode}</>);
const main = html.slice(html.search(/<main[\s>]/), html.lastIndexOf("</main>"));
// What a visitor reads in main: text nodes plus alt, with the visually
// hidden "@" dropped so the address reads as it is drawn.
const visibleText = decode(main.replace(/<span class="[^"]*visuallyHidden[^"]*">@<\/span>/g, "").replace(/<[^>]*>/g, "")).replace(/\s+/g, " ");
// The hero section alone: from its opening tag to its </section> (it nests none).
const heroStart = main.search(/<section[^>]*aria-labelledby="contact-heading"/);
const hero = main.slice(heroStart, main.indexOf("</section>", heroStart) + "</section>".length);
const noCvStart = main.search(/<section[^>]*aria-labelledby="no-cv-heading"/);
const noCv = main.slice(noCvStart, main.indexOf("</section>", noCvStart) + "</section>".length);
// The hero's links: exactly the two routes.
const anchors = [...hero.matchAll(/<a\s([^>]*)>([\s\S]*?)<\/a>/g)].map(([, attrs, inner]) => ({
  attrs,
  href: decode(attrs.match(/href="([^"]*)"/)?.[1] ?? ""),
  inner,
}));
const css = source("app/contact/contact.module.css");
// One rule's declarations from the module stylesheet.
const rule = (selector: string): string => {
  const match = new RegExp(`(?:^|\\n)\\${selector}\\s*\\{([^}]*)\\}`).exec(css);
  expect(match, `contact.module.css has a ${selector} rule`).not.toBeNull();
  return (match as RegExpExecArray)[1];
};

function positionOf(needle: string, label: string): number {
  const at = main.indexOf(needle);
  expect(at, `Contact is missing ${label}: "${needle}"`).toBeGreaterThan(-1);
  return at;
}

describe("the Contact hero", () => {
  test('the one h1 is "Two ways to reach me."', () => {
    const h1s = [...html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/g)];
    expect(h1s).toHaveLength(1);
    expect(h1s[0][1]).toBe("Two ways to reach me.");
    expect(contact.heading).toBe("Two ways to reach me.");
  });

  test("the copy reads as decided on 2026-10-15", () => {
    expect(contact.lede).toBe("Both go to me directly.");
    expect(contact.email.when).toBe("Best for a specific role, or a question about something on this site.");
    expect(contact.linkedin.when).toBe("Best if you want the full history before a conversation.");
    expect(contact.noCv.heading).toBe("There is no CV on this site, and that is deliberate.");
    expect(`${contact.noCv.lead} ${contact.noCv.ask}${contact.noCv.rest}`).toBe(
      "Every CV I send is written for one job description. Ask by email and I will send the version written for your role.",
    );
  });

  test("the hero is the deep ground and sets the on-deep focus ring for both links", () => {
    expect(main).toMatch(new RegExp(`<section[^>]*class="${escapeRegExp(styles.hero)}"`));
    const heroRule = rule(".hero");
    expect(heroRule).toMatch(/--focus-ring:\s*var\(--color-focus-ring-on-deep\)/);
    expect(heroRule).toMatch(/background:\s*var\(--color-deep\)/);
    expect(heroRule).toMatch(/color:\s*var\(--color-on-deep\)/);
  });

  test("the route links are route-link type, on-deep, with a 1.5px deep-accent underline; rows split by deep-rule", () => {
    const link = rule(".routeLink");
    expect(link).toMatch(/font-size:\s*var\(--type-route-link-size\)/);
    expect(link).toMatch(/color:\s*var\(--color-on-deep\)/);
    expect(link).toMatch(/text-decoration-color:\s*var\(--color-deep-accent\)/);
    expect(link).toMatch(/text-decoration-thickness:\s*var\(--component-contact-hero-route-link-underline-width\)/);
    expect(source("styles/tokens.css")).toMatch(/--component-contact-hero-route-link-underline-width:\s*1\.5px;/);
    expect(rule(".route")).toMatch(/border-top:\s*var\(--space-rule-hairline\) solid var\(--color-deep-rule\)/);
    expect(rule(".title")).toMatch(/font-size:\s*var\(--type-page-title-size\)/);
  });

  test("h1, line, email then its sentence, LinkedIn then its sentence, availability, then the no-CV statement, in order", () => {
    const order = [
      positionOf("<h1", "the h1"),
      positionOf(contact.lede, "the line under the heading"),
      positionOf(`href="mailto:${site.email}"`, "the email link"),
      positionOf(contact.email.when, "the email sentence"),
      positionOf(`href="${site.linkedin.href}"`, "the LinkedIn link"),
      positionOf(contact.linkedin.when, "the LinkedIn sentence"),
      positionOf(site.availability, "the availability line"),
      positionOf(`<div class="${styles.plate}">`, "the portrait plate"),
      positionOf(contact.noCv.heading, "the no-CV heading"),
      positionOf(contact.noCv.lead, "the no-CV statement"),
    ];
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });

  test("the text comes first in the source, and row-reverse draws the plate to its left on wide screens", () => {
    expect(hero.indexOf(`class="${styles.text}"`)).toBeLessThan(hero.indexOf(`class="${styles.plate}"`));
    expect(rule(".hero")).toMatch(/flex-direction:\s*row-reverse/);
    // Visual and DOM order differ on purpose: the plate holds nothing focusable.
    const plate = hero.slice(hero.indexOf(`class="${styles.plate}"`));
    expect(plate).not.toMatch(/<a[\s>]|<button[\s>]|tabindex=/);
  });

  test("the hero has exactly the two routes, each with its caps label", () => {
    expect(anchors.map((a) => a.href)).toEqual([`mailto:${site.email}`, site.linkedin.href]);
    expect(hero).toContain(`>${contact.email.label}</p>`);
    expect(hero).toContain(`>${contact.linkedin.label}</p>`);
  });

  test('the no-CV statement makes "Ask by email" a plain mailto: link', () => {
    const links = [...noCv.matchAll(/<a\s[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/g)].map((m) => [decode(m[1]), m[2]]);
    expect(links).toEqual([[`mailto:${site.email}`, "Ask by email"]]);
  });

  test("the email link is lightly obfuscated without impeding a screen reader", () => {
    const email = anchors[0];
    expect(email.inner).toMatch(/<span aria-hidden="true">@<\/span><span class="[^"]*visuallyHidden[^"]*">@<\/span>/);
    expect(html.replace(/href="[^"]*"/g, "")).not.toContain(site.email);
    expect(visibleText).toContain(site.email);
  });

  test("the LinkedIn link reads linkedin.com/in/shahrouz-mohaghegh, derived from site.linkedin.href", () => {
    expect(contact.linkedin.text).toBe("linkedin.com/in/shahrouz-mohaghegh");
    expect(source("content/contact.ts")).not.toContain('"linkedin.com/in/');
    expect(anchors[1].inner).toBe(contact.linkedin.text);
    expect(site.linkedin.href).toBe("https://www.linkedin.com/in/shahrouz-mohaghegh/");
  });

  test("both links carry the route-link class, so both take the ring", () => {
    for (const anchor of anchors) expect(anchor.attrs).toContain(`class="${styles.routeLink}"`);
  });

  test("the availability line is site.availability, never the mockup's stale line", () => {
    expect(main).toMatch(new RegExp(`<p[^>]*>${escapeRegExp(site.availability)}</p>`));
    expect(visibleText).not.toMatch(/available immediately/i);
  });
});

describe("the portrait plate", () => {
  const imgs = [...main.matchAll(/<img\s[^>]*>/g)].map((m) => m[0]);

  test("sizes matches the plate widths at the 768px switch, so a 1x screen fetches near 420px", () => {
    const tokens = source("styles/tokens.css");
    const mobile = tokens.match(/--space-contact-plate-mobile-width:\s*(\d+px)/)?.[1];
    const desktop = tokens.match(/--space-contact-plate-desktop-width:\s*(\d+px)/)?.[1];
    expect(source("styles/breakpoints.css")).toContain("@media (max-width: 767px)");
    expect(PORTRAIT_SIZES).toBe(`(max-width: 767px) ${mobile}, ${desktop}`);
    expect(imgs[0]).toContain(`sizes="${PORTRAIT_SIZES}"`);
  });

  test("lazy, with no priority, as on Home (AD-12): the plate is not the 375px LCP", () => {
    expect(imgs[0]).toContain('loading="lazy"');
    expect(imgs[0]).not.toMatch(/fetchpriority/i);
  });

  test("one image, its alt, explicit natural size, no priority, inside the studio-ground plate", () => {
    expect(imgs).toHaveLength(1);
    expect(imgs[0]).toContain(`alt="${contact.portrait.alt}"`);
    expect(imgs[0]).toContain('width="1311"');
    expect(imgs[0]).toContain('height="1200"');
    expect(imgs[0]).not.toMatch(/fetchpriority/i);
    expect(main).toMatch(new RegExp(`<div class="${escapeRegExp(styles.plate)}"><img`));
    const plate = rule(".plate");
    expect(plate).toMatch(/background:\s*var\(--color-studio-ground\)/);
    expect(plate).toMatch(/width:\s*var\(--space-contact-plate-width\)/);
    expect(plate).toMatch(/height:\s*var\(--space-contact-plate-height\)/);
    expect(rule(".portrait")).toMatch(/object-fit:\s*cover/);
  });

  test("the plate is never larger than the source, so the portrait is never upscaled", () => {
    const tokens = source("styles/tokens.css");
    for (const size of ["desktop", "mobile"]) {
      const width = Number(tokens.match(new RegExp(`--space-contact-plate-${size}-width:\\s*(\\d+)px`))?.[1]);
      const height = Number(tokens.match(new RegExp(`--space-contact-plate-${size}-height:\\s*(\\d+)px`))?.[1]);
      // object-fit: cover scales by the larger ratio; at most 1 means no upscale.
      expect(Math.max(width / contact.portrait.width, height / contact.portrait.height), size).toBeLessThanOrEqual(1);
    }
  });

  test("the file holds only IHDR, IDAT and IEND chunks, at its natural 1311 x 1200", () => {
    const path = join(process.cwd(), "public", contact.portrait.src);
    expect(existsSync(path), `${path} exists`).toBe(true);
    const bytes = readFileSync(path);
    expect(bytes.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
    const types = new Set<string>();
    for (let at = 8; at < bytes.length; ) {
      const length = bytes.readUInt32BE(at);
      types.add(bytes.subarray(at + 4, at + 8).toString("latin1"));
      at += 12 + length;
    }
    expect([...types].sort()).toEqual(["IDAT", "IEND", "IHDR"]);
    expect({ width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) }).toEqual({ width: 1311, height: 1200 });
  });
});

describe("what Contact never carries", () => {
  test("no form, no download, no CV document link", () => {
    expect(html).not.toMatch(/<form[\s>]|<input[\s>]|<textarea[\s>]/);
    // Tags only, values blanked, so the footer's "No CV download" prose never matches.
    const download = [...html.matchAll(/<(?:a|area)\b[^>]*>/gi)].some((tag) =>
      /\sdownload(?=[\s=/>])/i.test(tag[0].replace(/"[^"]*"|'[^']*'/g, '""')),
    );
    expect(download).toBe(false);
    expect(extractHrefs(html).filter((href) => cvDocumentProblem(href) !== null)).toEqual([]);
  });

  test("no reply-time promise", () => {
    const promise =
      /working day|same day|within (?:a|one|\d+) (?:day|hour|week)|within \d|\b24 ?h|hours?\b|promptly|quickly|as soon as|this week|usually (?:reply|respond|answer)|reply within|respond within/i;
    for (const text of [visibleText, contact.description, contact.portrait.alt]) expect(text).not.toMatch(promise);
  });

  test("no em dash in the page or its copy", () => {
    // Built from its code point, so this file holds no literal em dash.
    const emDash = String.fromCodePoint(0x2014);
    expect(html).not.toContain(emDash);
    expect(source("content/contact.ts")).not.toContain(emDash);
  });

  test("no banned word reaches the rendered page", () => {
    const file = ".forbidden-terms";
    expect(existsSync(file), `${file} is missing, so banned words cannot be checked`).toBe(true);
    const lines = readFileSync(file, "utf8").split("\n");
    const page = `${visibleText} ${contact.description} ${contact.portrait.alt}`;
    lines.forEach((raw, i) => {
      const term = raw.trim();
      if (!term || term.startsWith("#")) return;
      let pattern: RegExp;
      try {
        pattern = new RegExp(term, "i");
      } catch {
        throw new Error(`${file} line ${i + 1} is not a valid pattern`);
      }
      expect(pattern.test(page), `Contact contains the banned term on ${file} line ${i + 1}`).toBe(false);
    });
  });
});

describe("EmailAddress", () => {
  test("splits an address at its @ and hides the visible one from assistive technology", () => {
    const out = renderToStaticMarkup(<EmailAddress address="me@example.com" />);
    expect(out).toMatch(/^me<span aria-hidden="true">@<\/span><span class="[^"]*">@<\/span>example\.com$/);
  });

  test("renders a string with no @ as it is", () => {
    expect(renderToStaticMarkup(<EmailAddress address="not-an-address" />)).toBe("not-an-address");
  });
});

describe("how the route is built", () => {
  test('title "Contact", the meta description from content/contact.ts, and no noindex', () => {
    expect(contactModule.metadata.title).toBe("Contact");
    expect(contactModule.metadata.description).toBe(contact.description);
    expect(contactModule.metadata.robots).toBeUndefined();
  });

  test("marks Contact as the current nav item", () => {
    expect(html).toMatch(/<a[^>]*href="\/contact"[^>]*aria-current="page"|<a[^>]*aria-current="page"[^>]*href="\/contact"/);
  });

  test("static, and it reaches no island", () => {
    const page = source("app/contact/page.tsx");
    expect(page).not.toMatch(/"use client"|params|searchParams|cookies\(|headers\(|export const dynamic/);
    for (const path of ["app/contact/page.tsx", "components/email-address.tsx"]) {
      expect(specifiers(source(path)).filter((s) => /(^|\/)islands\//.test(s)), path).toEqual([]);
    }
  });
});
