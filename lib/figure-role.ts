// Figure demotion (DESIGN.md Typography, Figure demotion), implemented once.
// Step one: the rendered character count of the figure phrase selects the
// type role. Step two (a figure sharing a band demotes one further step) has
// no caller yet: every evidence band holds exactly one figure. The figure
// pair is exempt (step three) and never calls this.

export type FigureRole = "figure" | "figure-small" | "pull-quote";

export const FIGURE_MAX = 14;
export const FIGURE_SMALL_MAX = 32;

const graphemes = new Intl.Segmenter(undefined, { granularity: "grapheme" });

// Rendered characters: grapheme clusters, so a base letter and its combining
// mark count once.
export const renderedLength = (phrase: string): number => [...graphemes.segment(phrase)].length;

export function figureRole(phrase: string): FigureRole {
  if (/^https?:\/\//i.test(phrase.trim())) return "pull-quote";
  const length = renderedLength(phrase);
  if (length <= FIGURE_MAX) return "figure";
  if (length <= FIGURE_SMALL_MAX) return "figure-small";
  return "pull-quote";
}
