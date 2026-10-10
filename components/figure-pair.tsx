import styles from "./figure-pair.module.css";

export type FigurePairRow = { readonly label: string; readonly figure: string };

// {components.figure-pair}: above the fold on Home and nowhere else. Two
// stacked rows, each a one-line caps scope label above one serif figure.
// Never a reveal target and never inside an evidence band.
export function FigurePair({ rows }: { rows: readonly [FigurePairRow, FigurePairRow] }) {
  return (
    <dl className={styles.pair}>
      {rows.map(({ label, figure }) => (
        <div key={label} className={styles.row}>
          <dt className={styles.label}>{label}</dt>
          <dd className={styles.figure}>{figure}</dd>
        </div>
      ))}
    </dl>
  );
}
