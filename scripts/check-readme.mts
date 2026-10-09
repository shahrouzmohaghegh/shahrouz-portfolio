// Keeps README.md honest about what a reader relies on.
//
//   node scripts/check-readme.mts            reads the working tree (CI, by hand)
//   node scripts/check-readme.mts --staged   reads the index (the pre-commit hook)
//
// 1. Dependencies. Every package in package.json (dependencies,
//    devDependencies, peerDependencies, optionalDependencies) has exactly one
//    row in the first table of the README's Dependencies section, with a
//    non-empty reason, and the table names no package package.json lacks.
// 2. Checks. The Checks section lists every package.json script as an item
//    starting with `npm run <name>`, and every step name of the gate job in
//    ci.yml as a numbered item starting with **<name>**, and names nothing
//    that does not exist.
// 3. Links. Every relative link (inline, reference-style definition, or HTML
//    href/src) points to a file git tracks; a #fragment on the README itself
//    must match one of its headings, slugged as GitHub does. External links
//    (any scheme, or //host) are not checked. Code is not read for links.
//
// --staged reads README.md, package.json and ci.yml from the index with
// `git show :path`, so the hook checks what is being committed, matching
// `git ls-files`, which also reads the index. Paths are resolved from the
// repository root. Zero dependencies: the Markdown and YAML are read with
// small parsers that understand only the shapes these files use.

import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join, posix } from "node:path";
import { isEntryPoint } from "./entry-point.mts";

export const README_PATH = "README.md";
export const PACKAGE_PATH = "package.json";
export const CI_PATH = ".github/workflows/ci.yml";
export const GATE_JOB = "gate";
export const DEPENDENCIES_TITLE = "Dependencies";
export const CHECKS_TITLE = "Checks";

const MAX_BUFFER = 64 * 1024 * 1024;

export type Row = { name: string; reason: string };

// ---------------------------------------------------------------- package.json

type PackageJson = Partial<
  Record<"dependencies" | "devDependencies" | "peerDependencies" | "optionalDependencies" | "scripts", Record<string, string>>
>;

const GROUPS = ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"] as const;

// Every package name in the four dependency groups, once each, in file order.
export function packageNames(packageJsonText: string): string[] {
  const pkg = JSON.parse(packageJsonText) as PackageJson;
  return [...new Set(GROUPS.flatMap((group) => Object.keys(pkg[group] ?? {})))];
}

export function scriptNames(packageJsonText: string): string[] {
  return Object.keys((JSON.parse(packageJsonText) as PackageJson).scripts ?? {});
}

// ---------------------------------------------------------------- ci.yml

// The step names of one job, read by indentation: the job's line, then every
// `- name:` until the next line indented no deeper than the job.
export function gateStepNames(ciText: string, job = GATE_JOB): string[] {
  const lines = ciText.split(/\r?\n/);
  const start = lines.findIndex((line) => new RegExp(`^(\\s*)${job}:\\s*(#.*)?$`).test(line));
  if (start === -1) return [];
  const indent = lines[start].length - lines[start].trimStart().length;
  const names: string[] = [];
  for (const line of lines.slice(start + 1)) {
    const trimmed = line.trim();
    if (trimmed === "" || trimmed.startsWith("#")) continue;
    if (line.length - line.trimStart().length <= indent) break;
    const match = /^\s*-\s+name:\s*(.+?)\s*$/.exec(line);
    if (match) names.push(match[1].replace(/^(["'])(.*)\1$/, "$2"));
  }
  return names;
}

// ---------------------------------------------------------------- Markdown

const FENCE_OPEN = /^\s*(`{3,}|~{3,})/;

// Fenced code blocks blanked line for line, so line positions hold. A fence
// is three or more backticks or tildes at any indent, closed by a run of the
// same character at least as long with nothing after it; an unclosed fence
// runs to the end of the file.
export function withoutFences(markdown: string): string {
  const out: string[] = [];
  let fence: string | null = null;
  for (const line of markdown.split("\n")) {
    if (fence === null) {
      const open = FENCE_OPEN.exec(line);
      if (open) {
        fence = open[1];
        out.push("");
      } else {
        out.push(line);
      }
      continue;
    }
    const close = /^\s*(`{3,}|~{3,})\s*$/.exec(line);
    if (close && close[1][0] === fence[0] && close[1].length >= fence.length) fence = null;
    out.push("");
  }
  return out.join("\n");
}

// Code spans of any backtick run length (`a`, ``a ` b``) removed.
export function withoutCodeSpans(text: string): string {
  return text.replace(/(`+)(?!`)[\s\S]*?[^`]\1(?!`)/g, "");
}

export function withoutCode(markdown: string): string {
  return withoutCodeSpans(withoutFences(markdown));
}

type Heading = { level: number; text: string; line: number };

export function headings(markdown: string): Heading[] {
  const found: Heading[] = [];
  withoutFences(markdown)
    .split("\n")
    .forEach((line, index) => {
      const match = /^ {0,3}(#{1,6})\s+(.*?)(?:\s+#+)?\s*$/.exec(line);
      if (match) found.push({ level: match[1].length, text: match[2], line: index });
    });
  return found;
}

// The lines under a level-two heading with this title, up to the next
// heading of level one or two, fenced code blanked. Null when missing.
export function section(markdown: string, title: string): string[] | null {
  const all = headings(markdown);
  const at = all.findIndex((h) => h.level === 2 && h.text === title);
  if (at === -1) return null;
  const next = all.slice(at + 1).find((h) => h.level <= 2);
  const lines = withoutFences(markdown).split("\n");
  return lines.slice(all[at].line + 1, next ? next.line : lines.length);
}

// GitHub's heading anchors, as github-slugger makes them: rendered text
// lowercased, everything but letters, marks, numbers, connector punctuation,
// hyphens and spaces dropped (emoji included), each space to a hyphen,
// repeats suffixed -1, -2 and so on.
export function headingSlugs(markdown: string): Set<string> {
  const seen = new Map<string, number>();
  const slugs = new Set<string>();
  for (const { text } of headings(markdown)) {
    const rendered = text
      .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
      .replace(/<[^>]+>/g, "")
      .replace(/[`*]/g, "");
    const base = rendered
      .toLowerCase()
      .replace(/[^\p{L}\p{M}\p{N}\p{Pc}\- ]/gu, "")
      .replace(/ /g, "-");
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    slugs.add(count === 0 ? base : `${base}-${count}`);
  }
  return slugs;
}

// ---------------------------------------------------------------- Dependencies

// Splits a table line on unescaped pipes; \| is a literal pipe.
const cells = (line: string): string[] =>
  line
    .trim()
    .replace(/^\|/, "")
    .replace(/(?<!\\)\|$/, "")
    .split(/(?<!\\)\|/)
    .map((cell) => cell.replace(/\\\|/g, "|").trim());

// The rows of the first table in the Dependencies section, header and
// separator excluded. The package cell may be wrapped in backticks.
export function dependencyRows(readme: string): Row[] {
  const lines = section(readme, DEPENDENCIES_TITLE) ?? [];
  const first = lines.findIndex((line) => line.trim().startsWith("|"));
  if (first === -1) return [];
  const rest = lines.slice(first);
  const end = rest.findIndex((line) => !line.trim().startsWith("|"));
  return (end === -1 ? rest : rest.slice(0, end))
    .slice(1) // header
    .filter((line) => !/^\|?[\s:|-]+\|?$/.test(line.trim())) // separator
    .map((line) => {
      const [name = "", reason = ""] = cells(line);
      return { name: name.replace(/^`(.*)`$/, "$1").trim(), reason };
    });
}

export function dependencyProblems(readme: string, packages: string[]): string[] {
  if (section(readme, DEPENDENCIES_TITLE) === null) return [`${README_PATH} has no "## ${DEPENDENCIES_TITLE}" section`];
  const rows = dependencyRows(readme);
  const problems: string[] = [];
  const counts = new Map<string, number>();
  for (const row of rows) counts.set(row.name, (counts.get(row.name) ?? 0) + 1);
  for (const name of packages) {
    if (!counts.has(name)) problems.push(`${name}: in ${PACKAGE_PATH} but has no row in the Dependencies table`);
  }
  for (const [name, count] of counts) {
    if (count > 1) problems.push(`${name}: has ${count} rows in the Dependencies table`);
  }
  for (const row of rows) {
    if (!packages.includes(row.name)) {
      problems.push(`${row.name || "(blank)"}: has a row in the Dependencies table but is not in ${PACKAGE_PATH}`);
    } else if (row.reason === "") {
      problems.push(`${row.name}: the Dependencies table gives no reason`);
    }
  }
  return problems;
}

// ---------------------------------------------------------------- Checks

export type Listed = { scripts: string[]; steps: string[] };

// Items in the Checks section: `- \`npm run <script>\`` and `1. **<step>**`.
export function listedChecks(readme: string): Listed {
  const lines = section(readme, CHECKS_TITLE) ?? [];
  const scripts: string[] = [];
  const steps: string[] = [];
  for (const line of lines) {
    const script = /^\s*[-*+]\s+`npm run ([^`\s]+)`/.exec(line);
    if (script) scripts.push(script[1]);
    const step = /^\s*\d+[.)]\s+\*\*(.+?)\*\*/.exec(line);
    if (step) steps.push(step[1]);
  }
  return { scripts, steps };
}

const drift = (kind: string, source: string, actual: string[], listed: string[]): string[] => [
  ...actual.filter((name) => !listed.includes(name)).map((name) => `${kind} "${name}": in ${source} but not listed under Checks; add it to the README's Checks section in the same change`),
  ...listed.filter((name) => !actual.includes(name)).map((name) => `${kind} "${name}": listed under Checks but not in ${source}; if it was renamed or removed there, rename or remove it in the README's Checks section too`),
];

export function checksProblems(readme: string, scripts: string[], steps: string[]): string[] {
  if (section(readme, CHECKS_TITLE) === null) return [`${README_PATH} has no "## ${CHECKS_TITLE}" section`];
  const listed = listedChecks(readme);
  return [
    ...drift("npm script", PACKAGE_PATH, scripts, listed.scripts),
    ...drift("gate step", CI_PATH, steps, listed.steps),
  ];
}

// ---------------------------------------------------------------- Links

const TEXT = String.raw`(?:[^\[\]]|\[[^\[\]]*\])*`;
const DEST = String.raw`\s*(?:<([^>\n]*)>|([^\s()<>]+))(?:\s+(?:"[^"]*"|'[^']*'|\([^)]*\)))?\s*`;
const INLINE = new RegExp(String.raw`!?\[(${TEXT})\]\(${DEST}\)`, "g");
const DEFINITION = /^ {0,3}\[([^\]^][^\]]*)\]:[ \t]*(?:<([^>\n]*)>|(\S+))/gm;
const HTML_ATTR = /\b(?:href|src)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>"']+))/gi;

function inlineTargets(text: string): string[] {
  const targets: string[] = [];
  for (const match of text.matchAll(INLINE)) {
    targets.push(...inlineTargets(match[1])); // one level of nesting: [![alt](img)](href)
    targets.push(match[2] ?? match[3]);
  }
  return targets;
}

// Every link target in the README outside code: inline links and images,
// reference definitions, and HTML href and src attributes.
export function linkTargets(markdown: string): string[] {
  const text = withoutCode(markdown);
  const targets = inlineTargets(text);
  for (const match of text.matchAll(DEFINITION)) targets.push(match[2] ?? match[3]);
  for (const match of text.matchAll(HTML_ATTR)) targets.push(match[1] ?? match[2] ?? match[3]);
  return targets;
}

const isExternal = (target: string): boolean => /^[A-Za-z][A-Za-z0-9+.-]*:/.test(target) || target.startsWith("//");

export type Resolved = { path: string | null; fragment: string | null } | { error: string } | null;

// Where a link points: a repository path (null for a bare #fragment on the
// README) and its decoded fragment. Null for an external link.
export function resolveTarget(target: string): Resolved {
  if (isExternal(target)) return null;
  const hash = target.indexOf("#");
  const rawPath = (hash === -1 ? target : target.slice(0, hash)).replace(/\?.*$/, "");
  const rawFragment = hash === -1 ? null : target.slice(hash + 1);
  let path: string;
  let fragment: string | null;
  try {
    path = decodeURIComponent(rawPath);
    fragment = rawFragment === null ? null : decodeURIComponent(rawFragment);
  } catch {
    return { error: "malformed percent escape" };
  }
  return { path: path === "" ? null : posix.normalize(path.replace(/^\//, "")), fragment };
}

export function linkProblems(readme: string, tracked: Set<string>): string[] {
  const slugs = headingSlugs(readme);
  const problems: string[] = [];
  for (const target of linkTargets(readme)) {
    const resolved = resolveTarget(target);
    if (resolved === null) continue;
    if ("error" in resolved) {
      problems.push(`${target}: ${resolved.error}`);
      continue;
    }
    const { path, fragment } = resolved;
    if (path !== null && !tracked.has(path)) {
      problems.push(`${target}: link points to ${path}, which is not a tracked file`);
      continue;
    }
    if ((path === null || path === README_PATH) && fragment !== null && fragment !== "" && !slugs.has(fragment)) {
      problems.push(`${target}: no heading in ${README_PATH} has the anchor #${fragment}`);
    }
  }
  return problems;
}

// ---------------------------------------------------------------- main

export type Deps = {
  readFile: (path: string) => string;
  trackedFiles: () => string[];
  err: (text: string) => void;
};

export function main(deps: Deps): number {
  const readme = deps.readFile(README_PATH);
  const pkg = deps.readFile(PACKAGE_PATH);
  const problems = [
    ...dependencyProblems(readme, packageNames(pkg)),
    ...checksProblems(readme, scriptNames(pkg), gateStepNames(deps.readFile(CI_PATH))),
    ...linkProblems(readme, new Set(deps.trackedFiles())),
  ];
  if (problems.length === 0) return 0;
  deps.err(`check-readme: ${README_PATH} has ${problems.length} problem(s):\n${problems.map((p) => `  - ${p}`).join("\n")}`);
  return 1;
}

// ---------------------------------------------------------------- CLI

// Runs git and returns stdout; a spawn failure throws with its real cause.
export function git(args: string[], cwd?: string): string {
  const result = spawnSync("git", args, { cwd, encoding: "utf8", maxBuffer: MAX_BUFFER });
  if (result.error) throw new Error(`git ${args.join(" ")} could not run: ${result.error.message}`);
  if (result.status !== 0) throw new Error(`git ${args.join(" ")} failed: ${result.stderr.trim()}`);
  return result.stdout;
}

export function cliDeps(args: string[]): Deps {
  const unknown = args.filter((arg) => arg !== "--staged");
  if (unknown.length > 0) throw new Error(`unknown argument ${unknown.join(" ")}; the only option is --staged`);
  const root = git(["rev-parse", "--show-toplevel"]).trim();
  const staged = args.includes("--staged");
  return {
    readFile: staged ? (path) => git(["show", `:${path}`], root) : (path) => readFileSync(join(root, path), "utf8"),
    trackedFiles: () => git(["ls-files", "-z"], root).split("\0").filter(Boolean),
    err: (text) => console.error(text),
  };
}

const invokedDirectly = isEntryPoint(import.meta.url);
if (invokedDirectly) {
  try {
    process.exit(main(cliDeps(process.argv.slice(2))));
  } catch (error) {
    console.error(`check-readme: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}
