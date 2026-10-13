import styles from "./facts-strip.module.css";

export type Fact = { readonly term: string; readonly value: string };
export type FactsStripProps = { readonly facts: readonly Fact[] };

// {components.facts-strip}: a rule-bounded definition list near the top of a
// case study, term in caps and value at 600. Each fact is a <div> holding
// one dt and one dd, which a dl allows. The facts sit side by side while
// each has room and stack when the column is narrow. Server-rendered.
export function FactsStrip({ facts }: FactsStripProps) {
  if (facts.length === 0) throw new Error("<FactsStrip> needs at least one fact");
  for (const { term, value } of facts) {
    if (term.trim() === "" || value.trim() === "") throw new Error("<FactsStrip> facts need a term and a value");
  }
  return (
    <dl className={styles.strip}>
      {facts.map(({ term, value }) => (
        <div key={term} className={styles.fact}>
          <dt className={styles.term}>{term}</dt>
          <dd className={styles.value}>{value}</dd>
        </div>
      ))}
    </dl>
  );
}
