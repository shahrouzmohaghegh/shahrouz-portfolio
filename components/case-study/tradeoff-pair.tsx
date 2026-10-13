import type { ReactNode } from "react";

import { caseStudyPage } from "@/content/case-study-page";
import styles from "./tradeoff-pair.module.css";

export type TradeoffListProps = { readonly children: ReactNode };

export type TradeoffPairProps = {
  // The decision, as the item's h3.
  readonly decision: string;
  readonly buys: string;
  readonly costs: string;
  // Optional reasoning between the decision and the pair.
  readonly children?: ReactNode;
};

// The list that holds a section's trade-off pairs: an <ol>, one <li> per
// TradeoffPair, numbered by order rather than by a visible counter.
export function TradeoffList({ children }: TradeoffListProps) {
  return <ol className={styles.list}>{children}</ol>;
}

// {components.tradeoff-pair}: one decision in a Decisions or Trade-offs
// list. The decision is an h3, then two <div>s, each opened by a visible caps
// label: What it buys, then What it costs. The labels are real text, so the
// meaning survives the columns stacking at 375px, CSS being off and a reader
// who cannot tell the two rules apart. The sides differ by rule weight only, a
// tone-2 hairline above buys and a 2px ink rule above costs, never the accent.
// Server-rendered.
export function TradeoffPair({ decision, buys, costs, children }: TradeoffPairProps) {
  for (const [name, text] of [["decision", decision], ["buys", buys], ["costs", costs]] as const) {
    if (text.trim() === "") throw new Error(`<TradeoffPair> needs a ${name}`);
  }
  return (
    <li className={styles.item}>
      <h3 className={styles.heading}>{decision}</h3>
      {children !== undefined && <div className={styles.why}>{children}</div>}
      <div className={styles.pair}>
        <div className={styles.buys}>
          <p className={styles.label}>{caseStudyPage.tradeoff.buys}</p>
          <p className={styles.text}>{buys}</p>
        </div>
        <div className={styles.costs}>
          <p className={styles.label}>{caseStudyPage.tradeoff.costs}</p>
          <p className={styles.text}>{costs}</p>
        </div>
      </div>
    </li>
  );
}
