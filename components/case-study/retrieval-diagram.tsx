import { retrievalDiagram, type GateMark } from "@/content/retrieval-diagram";
import styles from "./retrieval-diagram.module.css";

// Decorative only: every gate's meaning is in its answer's words, so these
// are aria-hidden and the diagram reads the same without them.
const GLYPH: Record<GateMark, string> = { pass: "✓", fail: "✕", outranks: "↑", outranked: "↓" };
const GATES = ["relevant", "authority", "inForce"] as const;

// Story 3.4 (FR-36): an original diagram of how CS-2's governed retrieval
// layer decides, drawn from scratch from the case study's own prose. One
// question in two states, inside a temporary exception's window and after
// its expiry with the index unchanged. In each state both candidates pass
// three separate gates (relevant, authority, in force), each answered in
// words, and the answer inverts when only the calendar moves.
//
// HTML lists, not a table or an image: a <figure> whose visible
// <figcaption> is the text alternative, then each state as an h3 and an <ol>
// of the two candidates, each candidate's gates a <dl>, then "Answer:" and
// the winning guidance, then one line on what similarity alone would
// return. Order and meaning survive CSS being off; no distinction rests on
// colour or position (NFR-2), and the accent is never used. The two states
// stack below 768px and sit side by side when the column has room. All
// words come from content/retrieval-diagram.ts. Server-rendered.
export function RetrievalDiagram() {
  const { caption, question, gates, answerLabel, states, similarityAlone } = retrievalDiagram;
  for (const state of states) {
    if (state.candidates.filter((candidate) => candidate.wins).length !== 1) {
      throw new Error(`<RetrievalDiagram> state "${state.heading}" needs exactly one winning candidate`);
    }
  }
  return (
    <figure className={styles.figure}>
      <figcaption className={styles.caption}>{caption}</figcaption>
      <p className={styles.question}>{question}</p>
      <div className={styles.states}>
        {states.map((state) => (
          <div key={state.heading} className={styles.state}>
            <h3 className={styles.heading}>{state.heading}</h3>
            <ol className={styles.candidates}>
              {state.candidates.map((candidate) => (
                <li key={candidate.name} className={candidate.wins ? styles.winner : styles.candidate}>
                  <p className={styles.name}>{candidate.name}</p>
                  <p className={styles.guidance}>{candidate.guidance}</p>
                  <dl className={styles.gates}>
                    {GATES.map((gate) => (
                      <div key={gate} className={styles.gate}>
                        <dt className={styles.gateLabel}>{gates[gate]}</dt>
                        <dd className={styles.gateAnswer}>
                          <span aria-hidden="true" className={styles.glyph}>
                            {GLYPH[candidate[gate].mark]}
                          </span>{" "}
                          {candidate[gate].answer}
                        </dd>
                      </div>
                    ))}
                  </dl>
                  <p className={styles.verdict}>{candidate.verdict}</p>
                </li>
              ))}
            </ol>
            <p className={styles.answer}>
              <strong className={styles.answerLabel}>{answerLabel}</strong> {state.answer}
            </p>
          </div>
        ))}
      </div>
      <p className={styles.similarity}>{similarityAlone}</p>
    </figure>
  );
}
