import styles from "./figure-pair.module.css";

export type FigurePairRow = { readonly figure: string; readonly words: string; readonly scope: string };

// {components.figure-pair}: above the fold on Home and nowhere else. Two
// stacked rows, each a phrase (the number in bold serif, then what it
// measures in the same serif at regular weight) with its scope beneath, small
// and muted. The scope line is how FR-34 is met, so a row never renders
// without it. Never a reveal target and never inside an evidence band.
export function FigurePair({ rows }: { rows: readonly [FigurePairRow, FigurePairRow] }) {
  return (
    <div className={styles.pair}>
      {rows.map(({ figure, words, scope }) => (
        <div key={figure} className={styles.row}>
          <p className={styles.phrase}>
            <strong className={styles.figure}>{figure}</strong> {words}
          </p>
          <p className={styles.scope}>{scope}</p>
        </div>
      ))}
    </div>
  );
}
