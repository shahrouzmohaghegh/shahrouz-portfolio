import type { MDXComponents } from "mdx/types";

import { Section } from "@/components/mdx-section";

// The components every MDX file can use without importing them (AD-5).
// @next/mdx requires this file at the root for the App Router. Story 3.3
// adds the content components (facts strip, outcome band, key-value list,
// source note, trade-off pair) here.
const components = { Section } satisfies MDXComponents;

export function useMDXComponents(): MDXComponents {
  return components;
}
