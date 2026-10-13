import type { ReactNode } from "react";

import { figureRole } from "@/lib/figure-role";
import styles from "./outcome-band.module.css";

export type OutcomeBandProps = {
  // A meta-label above the figure, naming the measure.
  readonly tag: string;
  // The figure phrase, alone: "Bad fixes cut by more than 80%". No full stop.
  readonly figure: string;
  // The rest of the same sentence: scope and source, starting in lower case
  // and ending with a full stop. Required, so a bare figure cannot ship (FR-34).
  readonly qualifier: string;
  // Anything that follows the sentence, such as a link; it takes the on-deep ring.
  readonly children?: ReactNode;
};

// {components.outcome-band}: the headline result lifted out of the prose on
// the deep ground, inside the Outcome section's body column, not full bleed,
// so the rail stays beside it. The figure and its qualifier are one <p>, one
// sentence, the figure set in the role Figure demotion gives its length
// (lib/figure-role.ts) and the qualifier as the caption. The band sets
// --focus-ring to the on-deep value, so anything focusable inside it draws
// the ring styles/focus.css chooses for a deep ground. Server-rendered.
export function OutcomeBand({ tag, figure, qualifier, children }: OutcomeBandProps) {
  if (tag.trim() === "") throw new Error("<OutcomeBand> needs a tag");
  if (figure.trim() === "" || /[.!?]$/.test(figure.trim())) {
    throw new Error("<OutcomeBand> figure must be a phrase with no closing full stop; the qualifier ends the sentence");
  }
  if (!/^[a-z,][\s\S]*\.$/.test(qualifier.trim())) {
    throw new Error("<OutcomeBand> qualifier must continue the figure's sentence: start in lower case and end with a full stop (FR-34)");
  }
  return (
    <div className={styles.band}>
      <p className={styles.tag}>{tag}</p>
      <p className={styles.sentence}>
        <span className={styles.figure} data-figure-role={figureRole(figure.trim())}>
          {figure.trim()}
        </span>{" "}
        <span className={styles.caption}>{qualifier.trim()}</span>
      </p>
      {children}
    </div>
  );
}
