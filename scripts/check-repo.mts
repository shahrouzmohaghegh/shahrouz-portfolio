// Guards what can enter the public repository. Run by the git hooks in
// .githooks/ and by CI (.github/workflows/ci.yml).
//
//   node scripts/check-repo.mts                 checks the files staged for commit
//   node scripts/check-repo.mts --message FILE  also checks a commit message
//   node scripts/check-repo.mts --history       also checks every blob and every
//                                               commit message reachable from any
//                                               ref, local or remote-tracking
//
// CI runs --history, because pushing makes the whole history public: a term
// added in one commit and removed in a later one is still published.
//
// The confidential terms are read from .forbidden-terms, which is untracked:
// a public list would name the very terms it exists to keep out. CI writes
// it at job start from the FORBIDDEN_TERMS repository secret.

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const PLANNING_ALLOW_LIST = [
  "_bmad-output/planning-artifacts/architecture/architecture-ShahrouzPortfolio-2026-09-25/ARCHITECTURE-SPINE.md",
  "_bmad-output/planning-artifacts/architecture/architecture-ShahrouzPortfolio-2026-09-25/C4-ARCHITECTURE.md",
  "_bmad-output/planning-artifacts/briefs/brief-ShahrouzPortfolio-2026-09-23/brief.md",
  "_bmad-output/planning-artifacts/ux-designs/ux-ShahrouzPortfolio-2026-09-23/DESIGN.md",
  "_bmad-output/planning-artifacts/ux-designs/ux-ShahrouzPortfolio-2026-09-23/EXPERIENCE.md",
];
const NEVER_TRACKED = ["docs/", ".claude/", "_bmad/"];
const EM_DASH = new RegExp(String.fromCharCode(0x2014));
const TERMS_FILE = ".forbidden-terms";

const git = (...args: string[]): Buffer => execFileSync("git", args, { maxBuffer: 64 * 1024 * 1024 });

function loadTerms(): RegExp[] {
  if (!existsSync(TERMS_FILE)) {
    console.error(`check-repo: ${TERMS_FILE} is missing, so confidential terms cannot be checked.`);
    process.exit(1);
  }
  // An invalid pattern's SyntaxError quotes the pattern, which would print a
  // confidential term into a public CI log. Report the line number only.
  const terms: RegExp[] = [];
  readFileSync(TERMS_FILE, "utf8")
    .split("\n")
    .forEach((raw, i) => {
      const line = raw.trim();
      if (!line || line.startsWith("#")) return;
      try {
        terms.push(new RegExp(line, "i"));
      } catch {
        console.error(`check-repo: ${TERMS_FILE} line ${i + 1} is not a valid pattern`);
        process.exit(1);
      }
    });
  if (terms.length === 0) {
    console.error(`check-repo: ${TERMS_FILE} holds no terms, so confidential terms cannot be checked.`);
    process.exit(1);
  }
  return terms;
}

function scanText(label: string, text: string, terms: RegExp[], failures: string[]): void {
  text.split("\n").forEach((line, i) => {
    if (EM_DASH.test(line)) failures.push(`${label}:${i + 1}: em dash`);
    for (const term of terms) {
      if (term.test(line)) failures.push(`${label}:${i + 1}: matches a confidential term (${TERMS_FILE})`);
    }
  });
}

const failures: string[] = [];
const terms = loadTerms();
const tracked = git("ls-files", "-z").toString().split("\0").filter(Boolean);

const planning = tracked.filter((path) => path.startsWith("_bmad-output/")).sort();
for (const path of planning) {
  if (!PLANNING_ALLOW_LIST.includes(path)) failures.push(`${path}: not on the planning allow-list`);
}
for (const path of PLANNING_ALLOW_LIST) {
  if (!planning.includes(path)) failures.push(`${path}: approved planning file is not tracked`);
}
for (const path of tracked) {
  if (NEVER_TRACKED.some((prefix) => path.startsWith(prefix))) failures.push(`${path}: must never be tracked`);
}

for (const path of tracked) {
  const blob = git("show", `:${path}`);
  if (blob.includes(0)) continue; // binary
  scanText(path, blob.toString("utf8"), terms, failures);
}

const messageIndex = process.argv.indexOf("--message");
if (messageIndex !== -1) {
  const message = readFileSync(process.argv[messageIndex + 1], "utf8")
    .split("\n")
    .filter((line) => !line.startsWith("#"))
    .join("\n");
  scanText("commit message", message, terms, failures);
}

// History: every blob reachable from any ref (local branches, tags and
// remote-tracking branches such as origin/main, which a full-depth CI
// checkout provides), each scanned once, and every commit message in full. No '#' filter here: that exists only for the
// commit-msg template, and a published message line starting with '#' is
// still published.
if (process.argv.includes("--history")) {
  const objects = git("rev-list", "--objects", "--all").toString().split("\n").filter(Boolean);
  const pathOf = new Map<string, string>();
  for (const line of objects) {
    const [sha, ...rest] = line.split(" ");
    if (!pathOf.has(sha)) pathOf.set(sha, rest.join(" "));
  }
  const types = execFileSync("git", ["cat-file", "--batch-check=%(objecttype) %(objectname)"], {
    input: [...pathOf.keys()].join("\n") + "\n",
    maxBuffer: 64 * 1024 * 1024,
  })
    .toString()
    .split("\n")
    .filter((line) => line.startsWith("blob "));
  for (const line of types) {
    const sha = line.slice("blob ".length);
    const blob = git("cat-file", "blob", sha);
    if (blob.includes(0)) continue; // binary
    scanText(`history ${pathOf.get(sha)} (${sha.slice(0, 7)})`, blob.toString("utf8"), terms, failures);
  }

  const log = git("log", "-z", "--format=%H%n%B", "--all").toString().split("\0").filter(Boolean);
  for (const entry of log) {
    const newline = entry.indexOf("\n");
    const sha = entry.slice(0, newline);
    scanText(`commit message ${sha.slice(0, 7)}`, entry.slice(newline + 1), terms, failures);
  }
}

if (failures.length > 0) {
  console.error(`check-repo: ${failures.length} problem(s)\n${failures.map((f) => `  ${f}`).join("\n")}`);
  process.exit(1);
}
