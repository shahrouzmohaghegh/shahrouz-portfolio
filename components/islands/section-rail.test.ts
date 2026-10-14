// SectionRail (Story 3.2). The logic is startSectionRail, a plain function
// given the rail's nav, its document, window and IntersectionObserver
// constructor, so this suite runs in Vitest's node environment against small
// fakes, as the RevealOnScroll suite does. The markup itself (a plain anchor
// list with no aria-current) is checked by rendering the component.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";

import { RAIL_CURRENT, RAIL_ROOT_MARGIN, SectionRail, startSectionRail, type SectionRailEnvironment } from "./section-rail";

const SECTIONS = [
  { id: "context", label: "Context" },
  { id: "decisions", label: "Decisions" },
  { id: "actions", label: "Actions" },
  { id: "outcome", label: "Outcome" },
  { id: "lessons", label: "Lessons" },
];

type Entry = { target: FakeSection; isIntersecting: boolean };
type Callback = (entries: Entry[]) => void;
type ClickEvent = {
  target: unknown;
  defaultPrevented?: boolean;
  button?: number;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
};
type Listener = (event: ClickEvent) => void;

class FakeSection {
  readonly id: string;
  focused: Array<{ preventScroll?: boolean } | undefined> = [];
  constructor(id: string) {
    this.id = id;
  }
  focus(options?: { preventScroll?: boolean }): void {
    this.focused.push(options);
  }
}

class FakeLink {
  readonly attributes = new Map<string, string>();
  constructor(href: string) {
    this.attributes.set("href", href);
  }
  getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null;
  }
  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }
  removeAttribute(name: string): void {
    this.attributes.delete(name);
  }
  closest(selector: string): FakeLink | null {
    return selector === "a" ? this : null;
  }
}

// The counter span inside a link: a click on it bubbles up as a click on the link.
class FakeChild {
  readonly link: FakeLink;
  constructor(link: FakeLink) {
    this.link = link;
  }
  closest(selector: string): FakeLink | null {
    return this.link.closest(selector);
  }
}

class FakeObserver {
  readonly observed: FakeSection[] = [];
  disconnected = false;
  readonly callback: Callback;
  readonly options: IntersectionObserverInit;
  constructor(callback: Callback, options: IntersectionObserverInit) {
    this.callback = callback;
    this.options = options;
  }
  observe(target: FakeSection): void {
    this.observed.push(target);
  }
  disconnect(): void {
    this.disconnected = true;
  }
  fire(...entries: Array<[FakeSection, boolean]>): void {
    this.callback(entries.map(([target, isIntersecting]) => ({ target, isIntersecting })));
  }
}

function setup({ hash = "", observer = true }: { hash?: string; observer?: boolean } = {}) {
  const sections = SECTIONS.map(({ id }) => new FakeSection(id));
  const links = SECTIONS.map(({ id }) => new FakeLink(`#${id}`));
  const listeners = new Set<Listener>();
  const scrollListeners = new Set<() => void>();
  const observers: FakeObserver[] = [];
  // A page 3000px tall in an 800px viewport, scrolled to the top.
  const page = { scrollY: 0, innerHeight: 800, scrollHeight: 3000 };
  const nav = {
    querySelectorAll: (selector: string) => (selector === 'a[href^="#"]' ? links : []),
    addEventListener: (type: string, listener: Listener) => type === "click" && listeners.add(listener),
    removeEventListener: (type: string, listener: Listener) => type === "click" && listeners.delete(listener),
  };
  const environment = {
    nav,
    document: {
      getElementById: (id: string) => sections.find((section) => section.id === id) ?? null,
      documentElement: {
        get scrollHeight() {
          return page.scrollHeight;
        },
      },
    },
    window: {
      location: { hash },
      get scrollY() {
        return page.scrollY;
      },
      get innerHeight() {
        return page.innerHeight;
      },
      addEventListener: (type: string, listener: () => void) => type === "scroll" && scrollListeners.add(listener),
      removeEventListener: (type: string, listener: () => void) => type === "scroll" && scrollListeners.delete(listener),
    },
    IntersectionObserver: observer
      ? class {
          constructor(callback: Callback, options: IntersectionObserverInit) {
            const fake = new FakeObserver(callback, options);
            observers.push(fake);
            return fake;
          }
        }
      : undefined,
  } as unknown as SectionRailEnvironment;
  const current = (): string[] => links.filter((link) => link.getAttribute("aria-current") === "true").map((link) => link.getAttribute("href") ?? "");
  const click = (target: unknown, modifiers: Omit<ClickEvent, "target"> = {}): void =>
    listeners.forEach((listener) => listener({ target, button: 0, ...modifiers }));
  const scrollTo = (y: number): void => {
    page.scrollY = y;
    scrollListeners.forEach((listener) => listener());
  };
  return { sections, links, listeners, scrollListeners, observers, environment, current, click, scrollTo };
}

describe("startSectionRail", () => {
  test("the current marker is aria-current=\"true\"", () => {
    expect(RAIL_CURRENT).toEqual({ name: "aria-current", value: "true" });
  });

  test("the band is the top 40 percent of the viewport", () => {
    expect(RAIL_ROOT_MARGIN).toBe("0px 0px -60% 0px");
  });

  test("scrolled to the bottom, the last anchor is current even if its section never reached the band", () => {
    const { current, environment, observers, sections, scrollTo } = setup();
    startSectionRail(environment);
    observers[0].fire([sections[3], true]);
    expect(current()).toEqual(["#outcome"]);
    scrollTo(2198);
    expect(current()).toEqual(["#outcome"]);
    scrollTo(2200);
    expect(current()).toEqual(["#lessons"]);
    // Back up: the section in the band is current again.
    scrollTo(2000);
    expect(current()).toEqual(["#outcome"]);
  });

  test("an observer callback at the bottom also marks the last anchor", () => {
    const { current, environment, observers, sections, scrollTo } = setup();
    startSectionRail(environment);
    scrollTo(2200);
    observers[0].fire([sections[3], true]);
    expect(current()).toEqual(["#lessons"]);
  });

  test.each([
    ["Ctrl", { ctrlKey: true }],
    ["Cmd", { metaKey: true }],
    ["Shift", { shiftKey: true }],
    ["Alt", { altKey: true }],
    ["a middle", { button: 1 }],
    ["an already handled", { defaultPrevented: true }],
  ])("%s click leaves focus and the marker alone", (_label, modifiers) => {
    const { current, environment, links, sections, click } = setup();
    startSectionRail(environment);
    click(links[2], modifiers);
    expect(current()).toEqual(["#context"]);
    expect(sections[2].focused).toEqual([]);
  });

  test("with script, exactly one anchor is current from the start: the first", () => {
    const { current, environment } = setup();
    startSectionRail(environment);
    expect(current()).toEqual(["#context"]);
  });

  test("a deep link to a section starts with that anchor current", () => {
    const { current, environment } = setup({ hash: "#outcome" });
    startSectionRail(environment);
    expect(current()).toEqual(["#outcome"]);
  });

  test("every section is observed, and the last one in view is current", () => {
    const { current, environment, observers, sections } = setup();
    startSectionRail(environment);
    const [observer] = observers;
    expect(observer.observed.map((section) => section.id)).toEqual(SECTIONS.map(({ id }) => id));
    expect(observer.options.rootMargin).toBe(RAIL_ROOT_MARGIN);

    // The tail of Context and the start of Decisions share the band: Decisions is being read.
    observer.fire([sections[0], true], [sections[1], true]);
    expect(current()).toEqual(["#decisions"]);

    observer.fire([sections[0], false]);
    expect(current()).toEqual(["#decisions"]);

    observer.fire([sections[2], true]);
    expect(current()).toEqual(["#actions"]);

    // Scrolling back up: Actions leaves the band, Decisions is still in it.
    observer.fire([sections[2], false]);
    expect(current()).toEqual(["#decisions"]);
  });

  test("however the entries arrive, exactly one anchor is current", () => {
    const { current, environment, observers, sections } = setup();
    startSectionRail(environment);
    const [observer] = observers;
    for (const pattern of [[1, 1, 1, 1, 1], [0, 1, 0, 1, 0], [1, 0, 0, 0, 0], [0, 0, 0, 0, 0], [0, 0, 0, 0, 1]]) {
      observer.fire(...pattern.map((on, i): [FakeSection, boolean] => [sections[i], on === 1]));
      expect(current()).toHaveLength(1);
    }
  });

  test("when nothing is in view, the last current anchor stays current", () => {
    const { current, environment, observers, sections } = setup();
    startSectionRail(environment);
    const [observer] = observers;
    observer.fire([sections[3], true]);
    observer.fire([sections[3], false]);
    expect(current()).toEqual(["#outcome"]);
  });

  test("an activated anchor becomes current and moves focus to its section without a second scroll", () => {
    const { current, environment, links, sections, click } = setup();
    startSectionRail(environment);
    click(links[2]);
    expect(current()).toEqual(["#actions"]);
    expect(sections[2].focused).toEqual([{ preventScroll: true }]);
    click(new FakeChild(links[4]));
    expect(current()).toEqual(["#lessons"]);
    expect(sections[4].focused).toEqual([{ preventScroll: true }]);
  });

  test("a click that is not on a rail anchor changes nothing", () => {
    const { current, environment, sections, click } = setup();
    startSectionRail(environment);
    click({ closest: () => null });
    click(null);
    expect(current()).toEqual(["#context"]);
    expect(sections.every((section) => section.focused.length === 0)).toBe(true);
  });

  test("without IntersectionObserver nothing happens: no aria-current, no listener", () => {
    const { current, environment, listeners, scrollListeners } = setup({ observer: false });
    const stop = startSectionRail(environment);
    expect(current()).toEqual([]);
    expect(listeners.size).toBe(0);
    expect(scrollListeners.size).toBe(0);
    expect(() => stop()).not.toThrow();
  });

  test("an anchor whose section is missing is left alone", () => {
    const { current, environment, observers, links } = setup();
    links[0].setAttribute("href", "#gone");
    startSectionRail(environment);
    expect(observers[0].observed.map((section) => section.id)).toEqual(["decisions", "actions", "outcome", "lessons"]);
    expect(current()).toEqual(["#decisions"]);
  });

  test("the cleanup disconnects, removes the listeners and the marker", () => {
    const { current, environment, observers, listeners, scrollListeners } = setup();
    const stop = startSectionRail(environment);
    expect(scrollListeners.size).toBe(1);
    stop();
    expect(observers[0].disconnected).toBe(true);
    expect(listeners.size).toBe(0);
    expect(scrollListeners.size).toBe(0);
    expect(current()).toEqual([]);
  });
});

describe("SectionRail markup", () => {
  const html = renderToStaticMarkup(
    createElement(SectionRail, { sections: SECTIONS, label: "On this page", ariaLabel: "Sections of this case study" }),
  );

  test("is a labelled nav with the label, then an ordered list of in-page anchors", () => {
    expect(html).toMatch(/^<nav [^>]*aria-label="Sections of this case study"/);
    expect(html.indexOf(">On this page<")).toBeLessThan(html.indexOf("<ol"));
    const anchors = [...html.matchAll(/<a [^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/g)].map((m) => [m[1], m[2].replace(/<[^>]*>/g, "")]);
    expect(anchors).toEqual(SECTIONS.map(({ id, label }) => [`#${id}`, label]));
  });

  test("with JavaScript off no anchor is marked current", () => {
    expect(html).not.toContain("aria-current");
  });
});

// A project's rail (Story 3.5): eight sections under three group headers,
// each a <p> before the list it names, never a heading, and the repository
// link passed as children at the foot. The numbering is a CSS counter reset
// once on the nav, so it runs 01 to 08 through the groups.
describe("SectionRail with groups", () => {
  const GROUPS = [
    { label: "The build", sections: [{ id: "problem", label: "Problem" }, { id: "approach", label: "Approach" }] },
    { label: "How it held up", sections: [{ id: "tradeoffs", label: "Trade-offs" }] },
    { label: "What came of it", sections: [{ id: "outcome", label: "Outcome" }] },
  ];
  const foot = createElement("a", { href: "https://example.com/repo" }, "Repository");
  const html = renderToStaticMarkup(
    createElement(SectionRail, { groups: GROUPS, label: "On this page", ariaLabel: "Sections of this project" }, foot),
  );
  const css = readFileSync(join(process.cwd(), "components/islands/section-rail.module.css"), "utf8");
  const rule = (selector: string): string => css.match(new RegExp(`(?:^|\\n)${selector.replace(".", "\\.")} \\{([^}]*)\\}`))?.[1] ?? "";

  test("each group is a <p> label then its own ordered list, in order, after the rail label", () => {
    const parts = [...html.matchAll(/<p [^>]*>([^<]*)<\/p>|<ol[^>]*>([\s\S]*?)<\/ol>/g)].map((m) =>
      m[1] !== undefined ? `p ${m[1]}` : `ol ${[...m[2].matchAll(/href="#([^"]*)"/g)].map((a) => a[1]).join(",")}`,
    );
    expect(parts).toEqual([
      "p On this page",
      "p The build",
      "ol problem,approach",
      "p How it held up",
      "ol tradeoffs",
      "p What came of it",
      "ol outcome",
    ]);
  });

  test("a group header is not a heading, a link or a tab stop", () => {
    expect(html).not.toMatch(/<h[1-6][\s>]/);
    expect(html).not.toMatch(/tabindex/);
    expect([...html.matchAll(/<a [^>]*href="#/g)]).toHaveLength(4);
  });

  test("the children sit at the foot of the nav, after every list", () => {
    expect(html.indexOf('href="https://example.com/repo"')).toBeGreaterThan(html.lastIndexOf("</ol>"));
    expect(html.indexOf('href="https://example.com/repo"')).toBeLessThan(html.indexOf("</nav>"));
  });

  test("the counter is reset once, on the nav, so the numbering runs on through the groups", () => {
    expect(rule(".rail")).toMatch(/counter-reset:\s*rail;/);
    expect(rule(".list")).not.toMatch(/counter-reset/);
    expect(rule(".item")).toMatch(/counter-increment:\s*rail;/);
    expect(css.match(/counter-reset/g)).toHaveLength(1);
  });

  test("the script marks only in-page anchors, never the link at the foot", () => {
    const external = new FakeLink("https://example.com/repo");
    const { current, environment, links } = setup();
    const all = [...links, external];
    (environment.nav as { querySelectorAll: (s: string) => unknown }).querySelectorAll = (selector: string) =>
      selector === 'a[href^="#"]' ? all.filter((link) => (link.getAttribute("href") ?? "").startsWith("#")) : [];
    startSectionRail(environment);
    expect(current()).toEqual(["#context"]);
    expect(external.getAttribute("aria-current")).toBeNull();
  });
});

describe("SectionRail without groups (a case study)", () => {
  test("renders no group label, and nothing at the foot when given no children", () => {
    const html = renderToStaticMarkup(
      createElement(SectionRail, { sections: SECTIONS, label: "On this page", ariaLabel: "Sections of this case study" }),
    );
    expect(html.match(/<p[\s>]/g)).toHaveLength(1);
    expect(html.match(/<ol[\s>]/g)).toHaveLength(1);
    expect(html).toMatch(/<\/ol><\/nav>$/);
  });
});
