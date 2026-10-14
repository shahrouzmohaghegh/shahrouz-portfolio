"use client";

import { Fragment, useEffect, useRef, type ReactNode } from "react";

import styles from "./section-rail.module.css";

// SectionRail (AD-14): the in-page section list on a detail route, and the
// second and last island on the register. It imports no content and no
// other island: the sections, their labels and the rail's own words come in
// as props.
//
// The server renders a plain nav of in-page anchors, numbered 01 onward by a
// CSS counter that runs through every list in the nav. Given groups (a
// project's eight sections), each group is a non-heading <p> label and its
// own list, and the numbering still runs 01 to 08 (EXPERIENCE.md rail group
// header). Anything passed as children (a project's repository link) sits at
// the foot of the nav, after the lists; it is not an in-page anchor, so the
// script below never marks it. With JavaScript off the nav is a working
// contents list and no anchor claims to be current. With script,
// startSectionRail keeps aria-current="true" on exactly one anchor, following the sections through
// an IntersectionObserver, and an activated anchor moves focus to its
// section (each section is tabindex="-1"). Without IntersectionObserver it
// does nothing at all.

export const RAIL_CURRENT = { name: "aria-current", value: "true" } as const;
// A section counts as in view while it overlaps the top 40 percent of the
// viewport, so the current anchor follows the section being read, not the
// one just scrolling in at the bottom.
export const RAIL_ROOT_MARGIN = "0px 0px -60% 0px";

export type RailSection = { readonly id: string; readonly label: string };
export type RailGroup = { readonly label: string; readonly sections: readonly RailSection[] };

type RailLink = Pick<Element, "getAttribute" | "setAttribute" | "removeAttribute">;
type RailTarget = { focus(options?: FocusOptions): void };

export type SectionRailEnvironment = {
  nav: { querySelectorAll(selector: string): ArrayLike<RailLink> } & Pick<EventTarget, "addEventListener" | "removeEventListener">;
  document: { getElementById(id: string): RailTarget | null; documentElement: Pick<Element, "scrollHeight"> };
  window: { location: Pick<Location, "hash"> } & Pick<Window, "scrollY" | "innerHeight" | "addEventListener" | "removeEventListener">;
  IntersectionObserver: typeof IntersectionObserver | undefined;
};

// Returns a cleanup that disconnects, stops listening and clears the marker.
export function startSectionRail({ nav, document, window, IntersectionObserver: Observer }: SectionRailEnvironment): () => void {
  if (Observer === undefined) return () => {};

  const pairs = Array.from(nav.querySelectorAll('a[href^="#"]')).flatMap((link) => {
    const id = decodeURIComponent((link.getAttribute("href") ?? "").slice(1));
    const target = id === "" ? null : document.getElementById(id);
    return target === null ? [] : [{ link, target, hash: `#${id}` }];
  });
  if (pairs.length === 0) return () => {};

  const mark = (current: RailLink): void => {
    for (const { link } of pairs) {
      if (link === current) link.setAttribute(RAIL_CURRENT.name, RAIL_CURRENT.value);
      else link.removeAttribute(RAIL_CURRENT.name);
    }
  };
  mark((pairs.find((pair) => pair.hash === window.location.hash) ?? pairs[0]).link);

  const inView = new Set<unknown>();
  // Scrolled to the bottom, the last section is current: one shorter than
  // the 60 percent below the band never reaches the band by scrolling.
  // Otherwise the last section in document order that is in the band: the
  // one whose start the reader has most recently passed. A section scrolled
  // to the top leaves the tail of the one before it in the band too, and the
  // later one is the one being read. With none in view the marker stays put.
  const update = (): void => {
    const atBottom = window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 1;
    const last = atBottom ? pairs[pairs.length - 1] : [...pairs].reverse().find((pair) => inView.has(pair.target));
    if (last) mark(last.link);
  };
  const observer = new Observer(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) inView.add(entry.target);
        else inView.delete(entry.target);
      }
      update();
    },
    { rootMargin: RAIL_ROOT_MARGIN },
  );
  for (const { target } of pairs) observer.observe(target as unknown as Element);

  // The browser still follows the link and scrolls to the section; focus
  // moves there too, without a second scroll, so the next Tab continues from
  // the section a keyboard user chose.
  // A modified or non-primary click opens a new tab or window, so this tab's
  // focus and marker stay where they are.
  const onClick = (event: Event): void => {
    const mouse = event as MouseEvent;
    if (mouse.defaultPrevented || (mouse.button ?? 0) !== 0 || mouse.ctrlKey || mouse.metaKey || mouse.shiftKey || mouse.altKey) return;
    const origin = event.target as { closest?: (selector: string) => unknown } | null;
    const link = typeof origin?.closest === "function" ? origin.closest("a") : null;
    const pair = pairs.find((each) => each.link === link);
    if (!pair) return;
    mark(pair.link);
    pair.target.focus({ preventScroll: true });
  };
  nav.addEventListener("click", onClick);
  window.addEventListener("scroll", update, { passive: true });

  return () => {
    observer.disconnect();
    nav.removeEventListener("click", onClick);
    window.removeEventListener("scroll", update);
    for (const { link } of pairs) link.removeAttribute(RAIL_CURRENT.name);
  };
}

// Either one ungrouped run of sections (a case study) or labelled groups (a
// project), never both.
type RailContent =
  | { readonly sections: readonly RailSection[]; readonly groups?: never }
  | { readonly groups: readonly RailGroup[]; readonly sections?: never };

export type SectionRailProps = RailContent & {
  // The visible label above the list ("On this page").
  readonly label: string;
  // The nav's accessible name ("Sections of this case study").
  readonly ariaLabel: string;
  // Pinned at the foot of the rail, after the sections.
  readonly children?: ReactNode;
};

function RailList({ sections }: { readonly sections: readonly RailSection[] }) {
  return (
    <ol className={styles.list}>
      {sections.map(({ id, label }) => (
        <li key={id} className={styles.item}>
          <a href={`#${id}`} className={styles.link}>
            {label}
          </a>
        </li>
      ))}
    </ol>
  );
}

export function SectionRail({ sections, groups, label, ariaLabel, children }: SectionRailProps) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const nav = ref.current;
    if (nav === null) return;
    return startSectionRail({ nav, document, window, IntersectionObserver: window.IntersectionObserver });
  }, []);
  return (
    <nav ref={ref} aria-label={ariaLabel} className={styles.rail}>
      <p className={styles.label}>{label}</p>
      {groups === undefined ? (
        <RailList sections={sections} />
      ) : (
        groups.map((group) => (
          <Fragment key={group.label}>
            <p className={styles.groupLabel}>{group.label}</p>
            <RailList sections={group.sections} />
          </Fragment>
        ))
      )}
      {children}
    </nav>
  );
}
