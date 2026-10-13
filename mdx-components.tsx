import type { MDXComponents } from "mdx/types";

import { FactsStrip } from "@/components/case-study/facts-strip";
import { KeyValueList } from "@/components/case-study/key-value-list";
import { OutcomeBand } from "@/components/case-study/outcome-band";
import { RetrievalDiagram } from "@/components/case-study/retrieval-diagram";
import { SourceNote } from "@/components/case-study/source-note";
import { TradeoffList, TradeoffPair } from "@/components/case-study/tradeoff-pair";
import { Section } from "@/components/mdx-section";

// The components every MDX file can use without importing them (AD-5):
// Section, then the content components of Story 3.3 (facts strip, outcome
// band, key-value list, source note, and the trade-off pair with the list
// that holds it), then Story 3.4's retrieval-layer diagram. All are server
// components; none is an island. @next/mdx
// requires this file at the root for the App Router.
const components = {
  Section,
  FactsStrip,
  OutcomeBand,
  KeyValueList,
  SourceNote,
  TradeoffList,
  TradeoffPair,
  RetrievalDiagram,
} satisfies MDXComponents;

export function useMDXComponents(): MDXComponents {
  return components;
}
