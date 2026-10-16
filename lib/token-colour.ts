// One colour token's value from styles/tokens.css, for the one place that
// cannot use var(): the link preview image (app/opengraph-image.tsx), drawn
// at build where no stylesheet applies. Every design value still lives in
// tokens.css; a missing token throws, so the build fails rather than guess.

import { readFileSync } from "node:fs";
import { join } from "node:path";

export const TOKENS_PATH = "styles/tokens.css";

export function tokenColour(name: string, css: string = readFileSync(join(process.cwd(), TOKENS_PATH), "utf8")): string {
  const match = new RegExp(`--color-${name}:\\s*(#[0-9A-Fa-f]{3,8})\\s*;`).exec(css);
  if (match === null) throw new Error(`${TOKENS_PATH} has no --color-${name}`);
  return match[1];
}
