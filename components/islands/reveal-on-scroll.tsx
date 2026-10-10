"use client";

import { useEffect } from "react";

// RevealOnScroll (AD-14): the scroll reveal, and one of the two islands on
// the register. It imports no content and no other island, and renders
// nothing. Sections opt in with the global class `reveal`; styles/reveal.css
// hides them only under REVEAL_ROOT_CLASS on the root and restores them under
// REVEALED_CLASS. scripts/check-tokens.mts reads both constants from this file
// and fails if reveal.css stops restoring under them.
//
// Nothing is ever hidden without script, under reduced motion (read live),
// without matchMedia or IntersectionObserver, or in print. A band already in
// view or scrolled past when the script runs is marked revealed before the
// root class lands, so it never flashes out.

export const REVEAL_ROOT_CLASS = "js-reveal";
export const REVEALED_CLASS = "in";
export const REVEAL_TARGET = ".reveal";
export const REVEAL_THRESHOLD = 0.25;
export const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
// Every whole percent, so a band taller than four viewports still crosses a
// threshold when a quarter of the viewport shows it.
export const REVEAL_THRESHOLDS = Array.from({ length: 101 }, (_, i) => i / 100);

export type RevealEnvironment = {
  document: Pick<Document, "documentElement" | "querySelectorAll">;
  window: Partial<Pick<Window, "matchMedia" | "innerHeight">>;
  IntersectionObserver: typeof IntersectionObserver | undefined;
};

// Returns a cleanup that disconnects and removes the root class.
export function startReveal({ document, window, IntersectionObserver: Observer }: RevealEnvironment): () => void {
  if (typeof window.matchMedia !== "function" || Observer === undefined) return () => {};
  const motion = window.matchMedia(REDUCED_MOTION_QUERY);
  if (motion.matches) return () => {};

  const root = document.documentElement;
  const viewportHeight = (): number => window.innerHeight ?? 0;
  const targets = [...document.querySelectorAll(REVEAL_TARGET)];
  const reveal = (target: Element): void => target.classList.add(REVEALED_CLASS);
  // In view or already passed: revealed before anything can hide it.
  const pending = targets.filter((target) => {
    if (target.getBoundingClientRect().top >= viewportHeight()) return true;
    reveal(target);
    return false;
  });

  root.classList.add(REVEAL_ROOT_CLASS);
  const observer = new Observer(
    (entries, self) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const rootHeight = entry.rootBounds?.height ?? viewportHeight();
        const enough =
          entry.intersectionRatio >= REVEAL_THRESHOLD ||
          entry.intersectionRect.height >= REVEAL_THRESHOLD * rootHeight;
        if (!enough) continue;
        reveal(entry.target);
        self.unobserve(entry.target);
      }
    },
    { threshold: REVEAL_THRESHOLDS },
  );
  for (const target of pending) observer.observe(target);

  const stop = (): void => {
    observer.disconnect();
    root.classList.remove(REVEAL_ROOT_CLASS);
    motion.removeEventListener?.("change", onMotionChange);
  };
  // Reduced motion switched on mid-visit: show everything and stand down.
  function onMotionChange(event: { matches: boolean }): void {
    if (!event.matches) return;
    targets.forEach(reveal);
    stop();
  }
  motion.addEventListener?.("change", onMotionChange);
  return stop;
}

export function RevealOnScroll() {
  useEffect(
    () => startReveal({ document, window, IntersectionObserver: window.IntersectionObserver }),
    [],
  );
  return null;
}
