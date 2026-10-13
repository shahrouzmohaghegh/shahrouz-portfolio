import styles from "./source-note.module.css";

export type SourceNoteProps = {
  // What the number was measured with, as a sentence.
  readonly instrument: string;
  // How strong that instrument is, as a sentence: what it misses or skews.
  readonly weakness: string;
};

// {components.source-note}: beneath an outcome, small muted text on a tone-2
// left rule, stating where a number came from and how far to trust it,
// before a reader asks. Both halves are required, each a full sentence, so a
// note cannot ship that names the instrument and hides its weakness.
// Server-rendered.
export function SourceNote({ instrument, weakness }: SourceNoteProps) {
  for (const [name, sentence] of [["instrument", instrument], ["weakness", weakness]] as const) {
    if (!/^[A-Z][\s\S]*\.$/.test(sentence.trim())) {
      throw new Error(`<SourceNote> ${name} must be one or more full sentences, starting with a capital and ending with a full stop`);
    }
  }
  return (
    <p className={styles.note}>
      {instrument.trim()} {weakness.trim()}
    </p>
  );
}
