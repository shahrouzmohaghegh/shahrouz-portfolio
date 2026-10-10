"use client";

import { useEffect } from "react";

// RevealOnScroll (AD-14): the scroll reveal, and one of the two islands on
// the register. It imports no content and no other island, and renders
// nothing. Sections opt in with the global class `reveal`; styles/reveal.css
// hides them only under `.js-reveal`, which this island adds to the root as
// its first action. Without script, under reduced motion, without
// IntersectionObserver and in print, nothing is ever hidden.

export const REVEAL_THRESHOLD = 0.25;
export const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

export type RevealEnvironment = {
  document: Pick<Document, "documentElement" | "querySelectorAll">;
  window: Pick<Window, "matchMedia">;
  IntersectionObserver: typeof IntersectionObserver | undefined;
};

// Returns a cleanup that stops observing. Reduced motion is honoured by never
// hiding anything, not by overriding the transition.
export function startReveal({ document, window, IntersectionObserver: Observer }: RevealEnvironment): () => void {
  if (window.matchMedia(REDUCED_MOTION_QUERY).matches || Observer === undefined) return () => {};
  document.documentElement.classList.add("js-reveal");
  const observer = new Observer(
    (entries, self) => {
      for (const entry of entries) {
        if (!entry.isIntersecting || entry.intersectionRatio < REVEAL_THRESHOLD) continue;
        entry.target.classList.add("in");
        self.unobserve(entry.target);
      }
    },
    { threshold: REVEAL_THRESHOLD },
  );
  for (const target of document.querySelectorAll(".reveal")) observer.observe(target);
  return () => observer.disconnect();
}

export function RevealOnScroll() {
  useEffect(
    () => startReveal({ document, window, IntersectionObserver: window.IntersectionObserver }),
    [],
  );
  return null;
}
