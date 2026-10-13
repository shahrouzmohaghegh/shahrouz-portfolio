import styles from "./key-value-list.module.css";

export type KeyValueRow = { readonly term: string; readonly value: string };
export type KeyValueListProps = { readonly rows: readonly KeyValueRow[] };

// {components.kv-list}: repeats every number on the page, each with its
// scope, so a reader who skips the prose loses nothing. A definition list of
// hairline rows: the key muted, the value at 600 in tabular figures. Key
// beside value from 768px, key above value below it. Server-rendered.
export function KeyValueList({ rows }: KeyValueListProps) {
  if (rows.length === 0) throw new Error("<KeyValueList> needs at least one row");
  for (const { term, value } of rows) {
    if (term.trim() === "" || value.trim() === "") throw new Error("<KeyValueList> rows need a term and a value");
  }
  return (
    <dl className={styles.list}>
      {rows.map(({ term, value }) => (
        <div key={term} className={styles.row}>
          <dt className={styles.key}>{term}</dt>
          <dd className={styles.value}>{value}</dd>
        </div>
      ))}
    </dl>
  );
}
