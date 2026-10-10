// RevealOnScroll (AD-14). The logic is startReveal, a plain function given
// its document, window and IntersectionObserver constructor, so this suite
// runs in Vitest's node environment against small fakes and records the
// order things happen in.

import { describe, expect, test } from "vitest";

import {
  REDUCED_MOTION_QUERY,
  REVEALED_CLASS,
  REVEAL_ROOT_CLASS,
  REVEAL_THRESHOLDS,
  startReveal,
  type RevealEnvironment,
} from "./reveal-on-scroll";

const VIEWPORT = 800;

type Entry = {
  target: FakeElement;
  isIntersecting: boolean;
  intersectionRatio: number;
  intersectionRect: { height: number };
  rootBounds: { height: number } | null;
};
type Callback = (entries: Entry[], observer: FakeObserver) => void;

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
  remove(name: string): void {
    this.log.push(`remove ${name} from ${this.owner}`);
    this.names.delete(name);
  }
  contains(name: string): boolean {
    return this.names.has(name);
  }
}

class FakeElement {
  readonly classList: FakeClassList;
  readonly name: string;
  top: number;
  constructor(log: string[], name: string, top = 0) {
    this.name = name;
    this.top = top;
    this.classList = new FakeClassList(log, name);
  }
  getBoundingClientRect(): { top: number } {
    return { top: this.top };
  }
}

class FakeObserver {
  readonly observed = new Set<FakeElement>();
  disconnected = false;
  readonly callback: Callback;
  readonly options: { threshold?: number[] };
  private readonly log: string[];
  constructor(callback: Callback, options: { threshold?: number[] }, log: string[]) {
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
    this.log.push("disconnect");
    this.disconnected = true;
  }
  fire(target: FakeElement, intersectionRatio: number, visibleHeight = intersectionRatio * 400, rootHeight: number | null = VIEWPORT): void {
    if (!this.observed.has(target)) return;
    this.callback(
      [{
        target,
        isIntersecting: intersectionRatio > 0,
        intersectionRatio,
        intersectionRect: { height: visibleHeight },
        rootBounds: rootHeight === null ? null : { height: rootHeight },
      }],
      this,
    );
  }
}

type Options = { reducedMotion?: boolean; tops?: [number, number]; listeners?: boolean };

function setup({ reducedMotion = false, tops = [1000, 2000], listeners = true }: Options = {}) {
  const log: string[] = [];
  const root = new FakeElement(log, "root");
  const bands = [new FakeElement(log, "quality", tops[0]), new FakeElement(log, "security", tops[1])];
  const observers: FakeObserver[] = [];
  const queries: string[] = [];
  const motionListeners = new Set<(event: { matches: boolean }) => void>();
  const motion = {
    matches: reducedMotion,
    ...(listeners && {
      addEventListener: (_type: string, listener: (event: { matches: boolean }) => void) => motionListeners.add(listener),
      removeEventListener: (_type: string, listener: (event: { matches: boolean }) => void) => motionListeners.delete(listener),
    }),
  };
  const environment = {
    document: {
      documentElement: root,
      querySelectorAll: (selector: string) => {
        log.push(`query ${selector}`);
        return selector === ".reveal" ? bands : [];
      },
    },
    window: {
      innerHeight: VIEWPORT,
      matchMedia: (query: string) => {
        queries.push(query);
        return motion;
      },
    },
    IntersectionObserver: class {
      constructor(callback: Callback, options: { threshold?: number[] }) {
        log.push("construct observer");
        const observer = new FakeObserver(callback, options, log);
        observers.push(observer);
        return observer;
      }
    },
  } as unknown as RevealEnvironment;
  const switchMotion = (matches: boolean): void => motionListeners.forEach((listener) => listener({ matches }));
  return { log, root, bands, observers, queries, environment, motionListeners, switchMotion };
}

describe("startReveal", () => {
  test("the class names are the ones styles/reveal.css is written against", () => {
    expect(REVEAL_ROOT_CLASS).toBe("js-reveal");
    expect(REVEALED_CLASS).toBe("in");
  });

  test("reduced motion: no class is added and no observer is constructed", () => {
    const { log, root, observers, queries, environment } = setup({ reducedMotion: true });
    startReveal(environment);
    expect(queries).toEqual([REDUCED_MOTION_QUERY]);
    expect(root.classList.contains("js-reveal")).toBe(false);
    expect(observers).toHaveLength(0);
    expect(log).toEqual([]);
  });

  test("no IntersectionObserver or no matchMedia: nothing happens and nothing throws", () => {
    const first = setup();
    startReveal({ ...first.environment, IntersectionObserver: undefined });
    expect(first.log).toEqual([]);
    const second = setup();
    expect(() => startReveal({ ...second.environment, window: { innerHeight: VIEWPORT } })).not.toThrow();
    expect(second.log).toEqual([]);
  });

  test("motion allowed: the root class lands before the observer, then each band below the fold is observed", () => {
    const { log, root, observers, environment } = setup();
    startReveal(environment);
    expect(log).toEqual([
      "query .reveal",
      "add js-reveal to root",
      "construct observer",
      "observe quality",
      "observe security",
    ]);
    expect(root.classList.contains("js-reveal")).toBe(true);
    expect(observers).toHaveLength(1);
    expect(observers[0].options.threshold).toContain(0.25);
    expect(REVEAL_THRESHOLDS).toContain(0.25);
  });

  test("a band in view or already passed is revealed before the root class lands, and is not observed", () => {
    const { log, bands, environment } = setup({ tops: [-300, VIEWPORT - 1] });
    startReveal(environment);
    expect(log).toEqual([
      "query .reveal",
      "add in to quality",
      "add in to security",
      "add js-reveal to root",
      "construct observer",
    ]);
    expect(bands.every((band) => band.classList.contains("in"))).toBe(true);
  });

  test("a band gets `in` once it is 25 percent visible, and is then unobserved", () => {
    const { bands, observers, environment, log } = setup();
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
  });

  test("a band taller than four viewports is revealed once it fills a quarter of the viewport", () => {
    const { bands, observers, environment } = setup();
    startReveal(environment);
    const [observer] = observers;
    const [tall] = bands;
    observer.fire(tall, 0.04, 199);
    expect(tall.classList.contains("in")).toBe(false);
    observer.fire(tall, 0.05, 200);
    expect(tall.classList.contains("in")).toBe(true);
  });

  test("without rootBounds the viewport height is the measure", () => {
    const { bands, observers, environment } = setup();
    startReveal(environment);
    observers[0].fire(bands[0], 0.05, 200, null);
    expect(bands[0].classList.contains("in")).toBe(true);
  });

  test("the cleanup disconnects and removes the root class", () => {
    const { observers, environment, root, motionListeners } = setup();
    const stop = startReveal(environment);
    stop();
    expect(observers[0].disconnected).toBe(true);
    expect(root.classList.contains("js-reveal")).toBe(false);
    expect(motionListeners.size).toBe(0);
  });

  test("reduced motion switched on mid-visit reveals every band, removes the root class and disconnects", () => {
    const { observers, environment, root, bands, switchMotion } = setup();
    startReveal(environment);
    switchMotion(false);
    expect(root.classList.contains("js-reveal")).toBe(true);
    switchMotion(true);
    expect(bands.every((band) => band.classList.contains("in"))).toBe(true);
    expect(root.classList.contains("js-reveal")).toBe(false);
    expect(observers[0].disconnected).toBe(true);
  });

  test("a media query list without listeners still works", () => {
    const { environment, root } = setup({ listeners: false });
    const stop = startReveal(environment);
    expect(root.classList.contains("js-reveal")).toBe(true);
    expect(() => stop()).not.toThrow();
  });
});
