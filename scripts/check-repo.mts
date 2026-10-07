// Guards what can enter the public repository. Run by the git hooks in
// .githooks/ and, later, by CI.
//
//   node scripts/check-repo.mts                 checks the files staged for commit
//   node scripts/check-repo.mts --message FILE  also checks a commit message
//
// The confidential terms are read from .forbidden-terms, which is untracked:
// a public list would name the very terms it exists to keep out.

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
  return readFileSync(TERMS_FILE, "utf8")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .map((line) => new RegExp(line, "i"));
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

if (failures.length > 0) {
  console.error(`check-repo: ${failures.length} problem(s)\n${failures.map((f) => `  ${f}`).join("\n")}`);
  process.exit(1);
}
