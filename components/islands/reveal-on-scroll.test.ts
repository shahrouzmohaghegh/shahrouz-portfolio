// RevealOnScroll (AD-14). The logic is startReveal, a plain function given
// its document, window and IntersectionObserver constructor, so this suite
// runs in Vitest's node environment against small fakes and records the
// order things happen in.

import { describe, expect, test } from "vitest";

import { REVEAL_THRESHOLD, startReveal, type RevealEnvironment } from "./reveal-on-scroll";

type Callback = (entries: Array<{ target: FakeElement; isIntersecting: boolean; intersectionRatio: number }>, observer: FakeObserver) => void;

class FakeClassList {
  readonly names = new Set<string>();
  private readonly log: string[];
  private readonly owner: string;
  constructor(log: string[], owner: string) {
    this.log = log;
    this.owner = owner;
  }
  add(name: string): void {
    this.log.push(`add ${name} to ${this.owner}`);
    this.names.add(name);
  }
  contains(name: string): boolean {
    return this.names.has(name);
  }
}

class FakeElement {
  readonly classList: FakeClassList;
  readonly name: string;
  constructor(log: string[], name: string) {
    this.name = name;
    this.classList = new FakeClassList(log, name);
  }
}

class FakeObserver {
  readonly observed = new Set<FakeElement>();
  disconnected = false;
  readonly callback: Callback;
  readonly options: { threshold?: number };
  private readonly log: string[];
  constructor(callback: Callback, options: { threshold?: number }, log: string[]) {
    this.callback = callback;
    this.options = options;
    this.log = log;
  }
  observe(target: FakeElement): void {
    this.log.push(`observe ${target.name}`);
    this.observed.add(target);
  }
  unobserve(target: FakeElement): void {
    this.log.push(`unobserve ${target.name}`);
    this.observed.delete(target);
  }
  disconnect(): void {
    this.disconnected = true;
  }
  fire(target: FakeElement, intersectionRatio: number): void {
    if (!this.observed.has(target)) return;
    this.callback([{ target, isIntersecting: intersectionRatio > 0, intersectionRatio }], this);
  }
}

function setup(reducedMotion: boolean) {
  const log: string[] = [];
  const root = new FakeElement(log, "root");
  const bands = [new FakeElement(log, "quality"), new FakeElement(log, "security")];
  const observers: FakeObserver[] = [];
  const queries: string[] = [];
  const environment = {
    document: {
      documentElement: root,
      querySelectorAll: (selector: string) => {
        log.push(`query ${selector}`);
        return selector === ".reveal" ? bands : [];
      },
    },
    window: {
      matchMedia: (query: string) => {
        queries.push(query);
        return { matches: reducedMotion };
      },
    },
    IntersectionObserver: class {
      constructor(callback: Callback, options: { threshold?: number }) {
        log.push("construct observer");
        const observer = new FakeObserver(callback, options, log);
        observers.push(observer);
        return observer;
      }
    },
  } as unknown as RevealEnvironment;
  return { log, root, bands, observers, queries, environment };
}

describe("startReveal", () => {
  test("reduced motion: no class is added and no observer is constructed", () => {
    const { log, root, observers, queries, environment } = setup(true);
    startReveal(environment);
    expect(queries).toEqual(["(prefers-reduced-motion: reduce)"]);
    expect(root.classList.contains("js-reveal")).toBe(false);
    expect(observers).toHaveLength(0);
    expect(log).toEqual([]);
  });

  test("no IntersectionObserver: no class is added, so nothing is ever hidden", () => {
    const { log, root, environment } = setup(false);
    startReveal({ ...environment, IntersectionObserver: undefined });
    expect(root.classList.contains("js-reveal")).toBe(false);
    expect(log).toEqual([]);
  });

  test("motion allowed: the root class comes first, then the observer, then each band is observed", () => {
    const { log, root, observers, environment } = setup(false);
    startReveal(environment);
    expect(log).toEqual([
      "add js-reveal to root",
      "construct observer",
      "query .reveal",
      "observe quality",
      "observe security",
    ]);
    expect(root.classList.contains("js-reveal")).toBe(true);
    expect(observers).toHaveLength(1);
    expect(observers[0].options.threshold).toBe(0.25);
    expect(REVEAL_THRESHOLD).toBe(0.25);
  });

  test("a band gets `in` once it is 25 percent visible, and is then unobserved", () => {
    const { bands, observers, environment, log } = setup(false);
    startReveal(environment);
    const [observer] = observers;
    const [quality, security] = bands;

    observer.fire(quality, 0.1);
    expect(quality.classList.contains("in")).toBe(false);

    observer.fire(quality, 0.25);
    expect(quality.classList.contains("in")).toBe(true);
    expect(observer.observed.has(quality)).toBe(false);
    expect(security.classList.contains("in")).toBe(false);

    // Scrolling away and back changes nothing: the band is no longer observed.
    observer.fire(quality, 0);
    observer.fire(quality, 1);
    expect(log.filter((l) => l === "add in to quality")).toHaveLength(1);
    expect(quality.classList.contains("in")).toBe(true);
  });

  test("the returned cleanup disconnects the observer", () => {
    const { observers, environment } = setup(false);
    const stop = startReveal(environment);
    stop();
    expect(observers[0].disconnected).toBe(true);
  });
});
