// Keeps styles/tokens.css in step with DESIGN.md and keeps every other
// stylesheet on the tokens. Run by the pre-commit hook and, later, by CI.
//
//   node scripts/check-tokens.mts
//
// What it checks:
//   1. Parity. Every single-value entry in the DESIGN.md frontmatter groups
//      colors, typography, rounded and spacing has a token in tokens.css with
//      the same value, and every --color/font/type/radius/space-* token there
//      has a DESIGN.md source (or is a neutral desktop/mobile spacing token).
//   2. The type floor. No type size under 13.5px except the four roles
//      DESIGN.md sets below it.
//   3. breakpoints.css holds one @media rule whose :root remaps exactly the
//      base tokens that have a mobile value, each to that mobile token, and
//      app/layout.tsx imports tokens.css before breakpoints.css.
//   4. Every other stylesheet uses tokens only: no literal colour or length,
//      type properties set from tokens, no scaled type, no undefined var(),
//      no @media, @container, @custom-media or media-conditioned @import.
//
// Zero dependencies: the frontmatter is read with a minimal indentation
// parser that understands only the four groups it checks.

import { existsSync, readFileSync, readdirSync, realpathSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

export const DESIGN_PATH =
  "_bmad-output/planning-artifacts/ux-designs/ux-ShahrouzPortfolio-2026-09-23/DESIGN.md";
export const TOKENS_PATH = "styles/tokens.css";
export const BREAKPOINTS_PATH = "styles/breakpoints.css";
export const LAYOUT_PATH = "app/layout.tsx";

export const TYPE_FLOOR_PX = 13.5;
export const FLOOR_EXCEPTIONS = ["meta-label", "nameline", "kicker", "stage-number"];
export const MEDIA_PRELUDE = /^@media\s*\(\s*max-width\s*:\s*767px\s*\)$/;

// Component values are free-form prose in DESIGN.md and are not parsed, so
// the one component pair that switches at the breakpoint is named here.
export const COMPONENT_REMAPS: TokenMap = {
  "--component-capability-chip-padding": "var(--component-capability-chip-padding-mobile)",
};

const KNOWN_TOP_LEVEL = new Set([
  "title", "name", "description", "status", "created", "updated", "sources",
  "colors", "typography", "rounded", "spacing", "components",
]);
const PARITY_GROUPS: Array<keyof DesignGroups> = ["colors", "typography", "rounded", "spacing"];
const TYPE_PROPS = {
  fontFamily: "family",
  fontSize: "size",
  fontWeight: "weight",
  lineHeight: "leading",
  letterSpacing: "tracking",
};
const STACKS = { "serif-stack": "--font-serif", "sans-stack": "--font-sans" };

// ---------------------------------------------------------------- types

type TypeProp = keyof typeof TYPE_PROPS;
type StackRole = keyof typeof STACKS;
type FlatGroup = "colors" | "rounded" | "spacing";

// Custom property name to value, for tokens.css and every expectation.
export type TokenMap = Record<string, string>;
// One typography role: the TYPE_PROPS it sets, each to its DESIGN.md value.
export type TypeRole = Partial<Record<TypeProp, string>>;
export type DesignGroups = Record<FlatGroup, TokenMap> & { typography: Record<string, TypeRole> };
export type Frontmatter = { groups: DesignGroups; errors: string[] };
// A value is undefined only when a font stack role in DESIGN.md has no
// fontFamily; checkParity then reports that token against "undefined".
export type ExpectedTokens = Record<string, string | undefined>;
export type SpacingPair = { neutral: string; desktop: string; mobile: string };
export type RunResult = { failures: string[]; summary: string | null };
type RawLine = { line: string; number: number };

// `in` checks, kept as the parser has always done them, that also narrow.
const isTypeProp = (key: string): key is TypeProp => key in TYPE_PROPS;
const isStackRole = (key: string): key is StackRole => key in STACKS;

// Object.entries widens keys to string. parseFrontmatter stores a role key
// only after isTypeProp accepts it, and only string values, so this holds.
const typeEntries = (role: TypeRole): Array<[TypeProp, string]> =>
  Object.entries(role) as Array<[TypeProp, string]>;

const emptyGroups = (): DesignGroups => ({ colors: {}, rounded: {}, spacing: {}, typography: {} });
const PARITY_PREFIX = /^--(color|font|type|radius|space)-/;
const TOKEN_PREFIX = /^--(color|font|type|radius|space|component)-/;

// ---------------------------------------------------------------- parsing

// YAML's rule: '#' starts a comment at line start or after whitespace,
// outside quotes.
export function stripComment(line: string): string {
  let quote: string | null = null;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quote) {
      if (ch === quote) quote = null;
    } else if (ch === "'" || ch === '"') {
      quote = ch;
    } else if (ch === "#" && (i === 0 || /\s/.test(line[i - 1]))) {
      return line.slice(0, i).trimEnd();
    }
  }
  return line.trimEnd();
}

function unquote(value: string): string {
  const v = value.trim();
  if (v.length >= 2 && v.startsWith("'") && v.endsWith("'")) return v.slice(1, -1).replace(/''/g, "'");
  if (v.length >= 2 && v.startsWith('"') && v.endsWith('"')) return v.slice(1, -1);
  return v;
}

const indentOf = (line: string): number => line.length - line.trimStart().length;

// Returns { groups: { colors, typography, rounded, spacing }, errors }.
// colors, rounded, spacing: { key: value }. typography: { role: { prop: value } }.
export function parseFrontmatter(markdown: string): Frontmatter {
  const errors: string[] = [];
  const lines = markdown.split(/\r?\n/);
  if (lines[0].trim() !== "---") {
    return { groups: emptyGroups(), errors: ["DESIGN.md: no frontmatter"] };
  }
  const end = lines.findIndex((l, i) => i > 0 && l.trim() === "---");
  if (end === -1) return { groups: emptyGroups(), errors: ["DESIGN.md: frontmatter is not closed"] };

  const raw: Record<string, RawLine[]> = {};
  let current: string | null = null;
  for (let i = 1; i < end; i++) {
    const line = stripComment(lines[i]);
    if (line.trim() === "") continue;
    if (indentOf(line) === 0) {
      const m = line.match(/^([\w-]+):(.*)$/);
      if (!m) {
        errors.push(`DESIGN.md:${i + 1}: unparsed top-level line`);
        current = null;
        continue;
      }
      if (!KNOWN_TOP_LEVEL.has(m[1])) errors.push(`DESIGN.md:${i + 1}: unknown top-level group "${m[1]}"`);
      current = m[1];
      raw[current] = [];
      continue;
    }
    if (current) raw[current].push({ line, number: i + 1 });
  }

  const groups = emptyGroups();
  for (const name of ["colors", "rounded", "spacing"] as const) {
    for (const { line, number } of raw[name] ?? []) {
      const m = indentOf(line) === 2 && line.trim().match(/^([\w-]+):\s+(.+)$/);
      if (!m) {
        errors.push(`DESIGN.md:${number}: unparsed ${name} entry`);
        continue;
      }
      groups[name][m[1]] = unquote(m[2]);
    }
  }

  let role: string | null = null;
  for (const { line, number } of raw.typography ?? []) {
    const indent = indentOf(line);
    const text = line.trim();
    if (indent === 2 && /^[\w-]+:$/.test(text)) {
      role = text.slice(0, -1);
      groups.typography[role] = {};
      continue;
    }
    const m = indent === 4 && role && text.match(/^(\w+):\s+(.+)$/);
    // m is only truthy when role is set; the role check narrows it for TS.
    if (!m || role === null) {
      errors.push(`DESIGN.md:${number}: unparsed typography entry`);
      continue;
    }
    const prop = m[1];
    if (prop === "note") continue;
    if (!isTypeProp(prop)) {
      errors.push(`DESIGN.md:${number}: unknown typography property "${prop}"`);
      continue;
    }
    groups.typography[role][prop] = unquote(m[2]);
  }

  for (const name of PARITY_GROUPS) {
    if (Object.keys(groups[name]).length === 0) errors.push(`DESIGN.md: group "${name}" parsed empty`);
  }
  for (const [name, props] of Object.entries(groups.typography)) {
    if (Object.keys(props).length === 0) errors.push(`DESIGN.md: typography role "${name}" parsed empty`);
  }
  return { groups, errors };
}

// Custom property declarations in a stylesheet, as { name: value }.
// Accepts a final declaration without ';'.
export function parseDeclarations(css: string): TokenMap {
  const out: TokenMap = {};
  const text = stripCssComments(css);
  for (const m of text.matchAll(/(--[\w-]+)\s*:\s*([^;{}]+)/g)) out[m[1]] = m[2].trim().replace(/\s+/g, " ");
  return out;
}

export function stripCssComments(css: string): string {
  // Keeps newlines so line numbers survive.
  return css.replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, " "));
}

// ---------------------------------------------------------------- expectations

const COMPOSITE = /^(\S+)\s+x\s+(\S+)$/;
const isMobileRole = (role: string, typography: Record<string, TypeRole>): boolean =>
  role.endsWith("-mobile") && role.slice(0, -"-mobile".length) in typography;

function familyToken(value: string): string {
  const ref = value.match(/^\{typography\.([\w-]+)\.fontFamily\}$/);
  if (!ref) return value;
  const stack = ref[1];
  if (!isStackRole(stack)) throw new Error(`DESIGN.md: unknown font stack reference ${value}`);
  return `var(${STACKS[stack]})`;
}

// Every token DESIGN.md requires, as { name: value }.
export function expectedTokens(groups: DesignGroups): ExpectedTokens {
  const out: ExpectedTokens = {};
  for (const [key, value] of Object.entries(groups.colors)) out[`--color-${key}`] = value;

  for (const [role, props] of Object.entries(groups.typography)) {
    if (isStackRole(role)) {
      out[STACKS[role]] = props.fontFamily;
      continue;
    }
    for (const [prop, value] of typeEntries(props)) {
      out[`--type-${role}-${TYPE_PROPS[prop]}`] = prop === "fontFamily" ? familyToken(value) : value;
    }
  }

  for (const [key, value] of Object.entries(groups.rounded)) out[`--radius-${key.toLowerCase()}`] = value;

  for (const [key, value] of Object.entries(groups.spacing)) {
    const composite = value.match(COMPOSITE);
    if (composite) {
      out[`--space-${key}-width`] = composite[1];
      out[`--space-${key}-height`] = composite[2];
    } else {
      out[`--space-${key}`] = value;
    }
  }
  return out;
}

// Spacing pairs X-desktop / X-mobile, as [{ neutral, desktop, mobile }].
export function spacingPairs(groups: DesignGroups): SpacingPair[] {
  const pairs: SpacingPair[] = [];
  for (const [key, value] of Object.entries(groups.spacing)) {
    if (!key.endsWith("-desktop")) continue;
    const base = key.slice(0, -"-desktop".length);
    const mobileValue = groups.spacing[`${base}-mobile`];
    if (mobileValue === undefined) continue;
    const suffixes = COMPOSITE.test(value) ? ["-width", "-height"] : [""];
    if (COMPOSITE.test(value) !== COMPOSITE.test(mobileValue)) {
      throw new Error(`DESIGN.md: spacing ${base} mixes a composite and a single value`);
    }
    for (const s of suffixes) {
      pairs.push({
        neutral: `--space-${base}${s}`,
        desktop: `--space-${base}-desktop${s}`,
        mobile: `--space-${base}-mobile${s}`,
      });
    }
  }
  return pairs;
}

// Neutral spacing tokens in tokens.css, as { name: value }.
export function expectedNeutrals(groups: DesignGroups): TokenMap {
  return Object.fromEntries(spacingPairs(groups).map((p) => [p.neutral, `var(${p.desktop})`]));
}

// The declarations breakpoints.css must hold, as { name: value }.
export function expectedRemaps(groups: DesignGroups): TokenMap {
  const out: TokenMap = {};
  for (const [role, props] of Object.entries(groups.typography)) {
    if (!isMobileRole(role, groups.typography)) continue;
    const base = role.slice(0, -"-mobile".length);
    for (const [prop] of typeEntries(props)) {
      const p = TYPE_PROPS[prop];
      out[`--type-${base}-${p}`] = `var(--type-${role}-${p})`;
    }
  }
  for (const p of spacingPairs(groups)) out[p.neutral] = `var(${p.mobile})`;
  Object.assign(out, COMPONENT_REMAPS);
  return out;
}

// ---------------------------------------------------------------- checks

export function checkParity(expected: ExpectedTokens, neutrals: TokenMap, tokens: TokenMap): string[] {
  const failures: string[] = [];
  for (const [name, value] of Object.entries({ ...expected, ...neutrals })) {
    if (!(name in tokens)) failures.push(`${TOKENS_PATH}: ${name} is missing (DESIGN.md: ${value})`);
    else if (tokens[name] !== value) {
      failures.push(`${TOKENS_PATH}: ${name} is ${tokens[name]}, DESIGN.md says ${value}`);
    }
  }
  for (const name of Object.keys(tokens)) {
    if (!TOKEN_PREFIX.test(name)) {
      failures.push(`${TOKENS_PATH}: ${name} has no known token prefix`);
      continue;
    }
    if (PARITY_PREFIX.test(name) && !(name in expected) && !(name in neutrals)) {
      failures.push(`${TOKENS_PATH}: ${name} has no source in DESIGN.md`);
    }
  }
  return failures;
}

export function checkFloor(tokens: TokenMap): string[] {
  const failures: string[] = [];
  for (const [name, value] of Object.entries(tokens)) {
    const m = name.match(/^--type-([\w-]+?)(-mobile)?-size$/);
    if (!m) continue;
    const px = value.match(/^(\d*\.?\d+)px$/);
    if (!px) {
      failures.push(`${TOKENS_PATH}: ${name} is ${value}; type sizes must be px literals`);
      continue;
    }
    if (Number(px[1]) < TYPE_FLOOR_PX && !FLOOR_EXCEPTIONS.includes(m[1])) {
      failures.push(`${TOKENS_PATH}: ${name} is ${value}, under the ${TYPE_FLOOR_PX}px floor`);
    }
  }
  return failures;
}

// Index of the brace that closes the one opened at `open`, or -1.
function matchBrace(text: string, open: number): number {
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    if (text[i] === "{") depth++;
    else if (text[i] === "}" && --depth === 0) return i;
  }
  return -1;
}

export function checkBreakpoints(css: string, remaps: TokenMap, tokens: TokenMap): string[] {
  const label = BREAKPOINTS_PATH;
  const text = stripCssComments(css).trim();
  const open = text.indexOf("{");
  if (open === -1 || !MEDIA_PRELUDE.test(text.slice(0, open).trim())) {
    return [`${label}: must hold exactly one @media (max-width: 767px) rule`];
  }
  const close = matchBrace(text, open);
  if (close === -1) return [`${label}: unbalanced braces`];
  if (text.slice(close + 1).trim() !== "") return [`${label}: declares something outside the @media rule`];

  const inner = text.slice(open + 1, close).trim();
  const rootOpen = inner.indexOf("{");
  if (rootOpen === -1 || inner.slice(0, rootOpen).trim() !== ":root") {
    return [`${label}: the @media rule must hold one :root rule`];
  }
  const rootClose = matchBrace(inner, rootOpen);
  if (rootClose === -1) return [`${label}: unbalanced braces`];
  if (inner.slice(rootClose + 1).trim() !== "") return [`${label}: declares something outside :root`];

  const body = inner.slice(rootOpen + 1, rootClose);
  if (body.includes("{")) return [`${label}: nested rule inside :root`];

  const failures: string[] = [];
  const seen: TokenMap = {};
  for (const decl of body.split(";").map((d) => d.trim()).filter(Boolean)) {
    const m = decl.match(/^(--[\w-]+)\s*:\s*([\s\S]+)$/);
    if (!m) {
      failures.push(`${label}: "${decl}" is not a token remap`);
      continue;
    }
    const [, name, rawValue] = m;
    const value = rawValue.trim().replace(/\s+/g, " ");
    if (name in seen) failures.push(`${label}: ${name} is declared twice`);
    seen[name] = value;
    if (!(name in remaps)) failures.push(`${label}: ${name} is not an expected mobile remap`);
    else if (value !== remaps[name]) failures.push(`${label}: ${name} is ${value}, expected ${remaps[name]}`);
    if (!(name in tokens)) failures.push(`${label}: ${name} is not defined in ${TOKENS_PATH}`);
  }
  for (const [name, value] of Object.entries(remaps)) {
    if (!(name in seen)) failures.push(`${label}: missing remap ${name}: ${value}`);
    const target = value.match(/^var\((--[\w-]+)\)$/)?.[1];
    if (target && !(target in tokens)) failures.push(`${label}: ${target} is not defined in ${TOKENS_PATH}`);
  }
  return failures;
}

const LENGTH_LITERAL =
  /(?<![\w.#-])[+-]?(?:\d+\.?\d*|\.\d+)(?:px|pt|pc|cm|mm|in|q|rem|em|ch|ex|lh|rlh)\b/i;
const HEX_LITERAL = /#[0-9a-f]{3,8}\b/i;
const COLOUR_FUNCTION = /\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color|color-mix|light-dark)\(/i;
const SCALED_TYPE = /\b(?:calc|min|max|clamp)\([^;]*var\(\s*--type-/i;
const VAR_REFERENCE = /var\(\s*(--[\w-]+)/g;

// CSS named colours. transparent and currentColor are allowed on purpose.
const NAMED_COLOURS = new Set(`aliceblue antiquewhite aqua aquamarine azure beige bisque black
blanchedalmond blue blueviolet brown burlywood cadetblue chartreuse chocolate coral cornflowerblue
cornsilk crimson cyan darkblue darkcyan darkgoldenrod darkgray darkgreen darkgrey darkkhaki
darkmagenta darkolivegreen darkorange darkorchid darkred darksalmon darkseagreen darkslateblue
darkslategray darkslategrey darkturquoise darkviolet deeppink deepskyblue dimgray dimgrey dodgerblue
firebrick floralwhite forestgreen fuchsia gainsboro ghostwhite gold goldenrod gray green greenyellow
grey honeydew hotpink indianred indigo ivory khaki lavender lavenderblush lawngreen lemonchiffon
lightblue lightcoral lightcyan lightgoldenrodyellow lightgray lightgreen lightgrey lightpink
lightsalmon lightseagreen lightskyblue lightslategray lightslategrey lightsteelblue lightyellow lime
limegreen linen magenta maroon mediumaquamarine mediumblue mediumorchid mediumpurple mediumseagreen
mediumslateblue mediumspringgreen mediumturquoise mediumvioletred midnightblue mintcream mistyrose
moccasin navajowhite navy oldlace olive olivedrab orange orangered orchid palegoldenrod palegreen
paleturquoise palevioletred papayawhip peachpuff peru pink plum powderblue purple rebeccapurple red
rosybrown royalblue saddlebrown salmon sandybrown seagreen seashell sienna silver skyblue slateblue
slategray slategrey snow springgreen steelblue tan teal thistle tomato turquoise violet wheat white
whitesmoke yellow yellowgreen
accentcolor accentcolortext activetext buttonborder buttonface buttontext canvas canvastext field
fieldtext graytext highlight highlighttext linktext mark marktext selecteditem selecteditemtext
visitedtext`.split(/\s+/));

// Type properties take a token or a CSS-wide keyword, nothing else.
const TYPE_PROPERTIES = new Set(["font", "font-size", "font-weight", "font-family", "line-height", "letter-spacing"]);
const CSS_WIDE_KEYWORDS = new Set(["inherit", "initial", "unset", "revert", "revert-layer"]);

function typeValueProblem(property: string, value: string): string | null {
  if (!TYPE_PROPERTIES.has(property.toLowerCase())) return null;
  const v = value.replace(/\s*!important\s*$/i, "").trim();
  if (CSS_WIDE_KEYWORDS.has(v.toLowerCase())) return null;
  const rest = v.replace(/var\(\s*--[\w-]+\s*\)/g, "");
  if (v !== rest && /^[\s/]*$/.test(rest)) return null;
  return `${property} must be a var(--type-*) token or a CSS-wide keyword, not "${v}"`;
}

// The at-rules that would introduce a second breakpoint. Returns the
// offending at-rule name or null.
export function breakpointAtRule(statement: string): string | null {
  const s = statement.trim();
  const at = s.match(/@(media|container|custom-media)\b/i);
  if (at) return `@${at[1].toLowerCase()}`;
  const imp = s.match(/@import\b([\s\S]*)$/i);
  if (imp) {
    const condition = imp[1]
      .replace(/url\([^)]*\)|(["'])(?:\\.|(?!\1).)*\1/gi, "")
      .replace(/\b(?:layer|supports)\([^)]*\)|\blayer\b/gi, "")
      .trim();
    if (condition) return "@import with a media condition";
  }
  return null;
}

function scanValue(value: string, defined: ReadonlySet<string>): string[] {
  const problems: string[] = [];
  const bare = value
    .replace(/(["'])(?:\\.|(?!\1).)*\1/g, '""')
    .replace(/url\([^)]*\)/gi, "url()");
  if (HEX_LITERAL.test(bare)) problems.push("literal hex colour");
  if (COLOUR_FUNCTION.test(bare)) problems.push("literal colour function");
  // A word followed by "(" is a function name (tan(), url()), not a colour.
  const words = bare.replace(/--[\w-]+/g, " ").match(/[a-z][\w-]*(?![\w-]|\()/gi) ?? [];
  const named = words.find((w) => NAMED_COLOURS.has(w.toLowerCase()));
  if (named) problems.push(`named colour "${named}"`);
  const length = bare.match(LENGTH_LITERAL);
  if (length) problems.push(`literal length "${length[0]}"`);
  if (SCALED_TYPE.test(bare)) problems.push("scaled type token");
  for (const m of bare.matchAll(VAR_REFERENCE)) {
    if (!defined.has(m[1])) problems.push(`undefined variable ${m[1]}`);
  }
  return problems;
}

// Scans a stylesheet other than tokens.css and breakpoints.css. `defined` is
// the set of custom properties those two files declare.
export function scanStylesheet(label: string, css: string, defined: ReadonlySet<string>): string[] {
  const failures: string[] = [];
  const text = stripCssComments(css);
  const local = new Set([...defined, ...Object.keys(parseDeclarations(css))]);

  let depth = 0;
  let segment = "";
  let segmentLine = 1;
  let line = 1;
  const flush = (isDeclaration: boolean): void => {
    const s = segment.trim();
    if (s && isDeclaration) {
      const m = s.match(/^(--[\w-]+|[a-z-]+)\s*:\s*([\s\S]*)$/i);
      if (m) {
        const problems = scanValue(m[2], local);
        const typeProblem = typeValueProblem(m[1], m[2].trim());
        if (typeProblem) problems.push(typeProblem);
        for (const p of problems) failures.push(`${label}:${segmentLine}: ${p}`);
      }
    }
    const atRule = breakpointAtRule(s);
    if (atRule) failures.push(`${label}:${segmentLine}: ${atRule} belongs only in ${BREAKPOINTS_PATH}`);
    segment = "";
  };
  for (const ch of text) {
    if (segment.trim() === "" && !/\s/.test(ch)) segmentLine = line;
    if (ch === "{") {
      flush(false);
      depth++;
    } else if (ch === ";") {
      flush(depth > 0);
    } else if (ch === "}") {
      flush(depth > 0);
      depth = Math.max(0, depth - 1);
    } else {
      segment += ch;
    }
    if (ch === "\n") line++;
  }
  flush(false);
  return failures;
}

// The mobile remaps only win if breakpoints.css loads after tokens.css: both
// target :root at equal specificity.
export function checkLayoutImports(source: string | null): string[] {
  if (source === null) return [`${LAYOUT_PATH}: missing`];
  const imports = [...source.matchAll(/^\s*import\s+["']([^"']+)["']/gm)].map((m) => m[1]);
  const tokensAt = imports.indexOf("@/styles/tokens.css");
  const breakpointsAt = imports.indexOf("@/styles/breakpoints.css");
  const failures: string[] = [];
  if (tokensAt === -1) failures.push(`${LAYOUT_PATH}: must import @/styles/tokens.css`);
  if (breakpointsAt === -1) failures.push(`${LAYOUT_PATH}: must import @/styles/breakpoints.css`);
  if (tokensAt !== -1 && breakpointsAt !== -1 && breakpointsAt < tokensAt) {
    failures.push(`${LAYOUT_PATH}: must import @/styles/tokens.css before @/styles/breakpoints.css`);
  }
  return failures;
}

// ---------------------------------------------------------------- runner

const SKIP_DIRS = new Set(["node_modules", "_bmad", "_bmad-output", "docs", "out", "build"]);

export function findStylesheets(root: string, dir: string = root): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    // SKIP_DIRS applies at the repository root only, so app/docs/ is scanned.
    if (entry.name.startsWith(".") || (dir === root && SKIP_DIRS.has(entry.name))) continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...findStylesheets(root, path));
    else if (entry.name.endsWith(".css")) found.push(relative(root, path).split("\\").join("/"));
  }
  return found.sort();
}

export function run(root: string = process.cwd()): RunResult {
  const read = (path: string): string => readFileSync(join(root, path), "utf8");
  const { groups, errors } = parseFrontmatter(read(DESIGN_PATH));
  if (errors.length > 0) return { failures: errors, summary: null };

  const expected = expectedTokens(groups);
  const neutrals = expectedNeutrals(groups);
  const remaps = expectedRemaps(groups);
  const tokensCss = read(TOKENS_PATH);
  const tokens = parseDeclarations(tokensCss);

  const failures = [
    ...checkParity(expected, neutrals, tokens),
    ...checkFloor(tokens),
  ];
  for (const statement of stripCssComments(tokensCss).split(/[;{}]/)) {
    const atRule = breakpointAtRule(statement);
    if (atRule) failures.push(`${TOKENS_PATH}: ${atRule} belongs only in ${BREAKPOINTS_PATH}`);
  }
  failures.push(...checkLayoutImports(existsSync(join(root, LAYOUT_PATH)) ? read(LAYOUT_PATH) : null));
  if (!existsSync(join(root, BREAKPOINTS_PATH))) failures.push(`${BREAKPOINTS_PATH}: missing`);
  else failures.push(...checkBreakpoints(read(BREAKPOINTS_PATH), remaps, tokens));

  const defined = new Set(Object.keys(tokens));
  const sheets = findStylesheets(root).filter((p) => p !== TOKENS_PATH && p !== BREAKPOINTS_PATH);
  for (const path of sheets) failures.push(...scanStylesheet(path, read(path), defined));

  return {
    failures,
    summary:
      `${Object.keys(expected).length} tokens checked against DESIGN.md, ` +
      `${Object.keys(neutrals).length} neutral spacing tokens, ` +
      `${Object.keys(remaps).length} mobile remaps, ${sheets.length} other stylesheet(s) scanned`,
  };
}

// realpath, so a symlinked invocation still runs the check rather than
// exiting 0 having checked nothing.
const invokedDirectly = ((): boolean => {
  try {
    return process.argv[1] !== undefined && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url);
  } catch {
    return false;
  }
})();
if (invokedDirectly) {
  const { failures, summary } = run();
  if (failures.length > 0) {
    console.error(`check-tokens: ${failures.length} problem(s)\n${failures.map((f) => `  ${f}`).join("\n")}`);
    process.exit(1);
  }
  console.log(`check-tokens: ok, ${summary}`);
}
