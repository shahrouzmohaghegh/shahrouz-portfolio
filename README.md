# Shahrouz Mohaghegh

The personal website of Shahrouz Mohaghegh, live at [shahrouzmohaghegh.com](https://shahrouzmohaghegh.com). It is a small, statically rendered Next.js site, built with BMAD agents while Shahrouz held the requirements, architecture, decisions and review.

## Run locally

Node 24 is required. `.npmrc` sets `engine-strict`, so installing under any other version fails rather than warning.

```sh
nvm use
npm ci
npm run dev
```

Then turn on the git hooks once, as described under [One-time setup after cloning](#one-time-setup-after-cloning).

## How it is structured

The site follows the islands paradigm: every page is server-rendered HTML, and client JavaScript exists only in named islands under `components/islands/`. The island register lives in [`ARCHITECTURE-SPINE.md`](_bmad-output/planning-artifacts/architecture/architecture-ShahrouzPortfolio-2026-09-25/ARCHITECTURE-SPINE.md) and is closed at two islands, both planned and not yet built. `lib/` owns the shared logic between content and the page, such as the typed view of content and the filter, and like everything else imports nothing upward from `components/` or `app/` (AD-10 in the spine). Every design value lives in `styles/tokens.css`; no other stylesheet may use a literal colour or length, and `scripts/check-tokens.mts` enforces it.

```text
app/             Routes and layouts (Next.js App Router); composes components
components/      Server components; read content, never import upward
  islands/       The only client components, each named in the architecture
content/         Typed content as data; imports nothing from components/ or app/
lib/             Shared logic used by routes and components
styles/          tokens.css (every design value) and breakpoints.css (the only media query)
scripts/         Repository checks and tooling, in TypeScript, each with tests
.github/         The CI gate, the monthly pin review and Dependabot settings
.githooks/       Local pre-commit and commit-msg hooks
_bmad-output/    The published subset of the planning documents
```

`content/ad-10-probe.ts` is a deliberate probe that keeps the lint rule on import direction firing; it is not dead code.

## Architecture and planning

- [Architecture spine](_bmad-output/planning-artifacts/architecture/architecture-ShahrouzPortfolio-2026-09-25/ARCHITECTURE-SPINE.md): the architecture decisions every part of the code follows.
- [C4 architecture](_bmad-output/planning-artifacts/architecture/architecture-ShahrouzPortfolio-2026-09-25/C4-ARCHITECTURE.md): the system drawn at context, container and component level.
- [Product brief](_bmad-output/planning-artifacts/briefs/brief-ShahrouzPortfolio-2026-09-23/brief.md): who the site is for and what it must do.
- [Design](_bmad-output/planning-artifacts/ux-designs/ux-ShahrouzPortfolio-2026-09-23/DESIGN.md): how the site looks, and the source of the design tokens.
- [Experience](_bmad-output/planning-artifacts/ux-designs/ux-ShahrouzPortfolio-2026-09-23/EXPERIENCE.md): how the site behaves.

These five are the only planning files published. The product requirements, the epics, the reviews, the mockups and the working notes are private by design and are kept out of the repository, so some links inside these documents do not resolve.

## Dependencies

| Package | Why it is here |
| --- | --- |
| `next` | The framework: App Router, static rendering and the build. |
| `react` | The component model Next.js renders. |
| `react-dom` | Renders React to HTML on the server and hydrates the islands. |
| `@types/node` | Types for Node APIs used by the scripts and config, held at the pinned Node major. |
| `@types/react` | Types for React under strict TypeScript. |
| `@types/react-dom` | Types for React DOM under strict TypeScript. |
| `eslint` | Runs the lint step of the gate. |
| `eslint-config-next` | The Next.js lint rules, and the import plugin that enforces dependency direction. |
| `typescript` | Strict type checking of the site and the scripts. |

There is no component library, CSS framework or animation library. A dependency without a row here fails `scripts/check-readme.mts`.

## Checks

npm scripts:

- `npm run dev`: the local development server.
- `npm run build`: the production build (`next build`).
- `npm run start`: serves the production build.
- `npm run lint`: ESLint, including the import direction rule.
- `npm run typecheck`: `tsc --noEmit` over the site and the scripts.
- `npm run check:tokens`: keeps `styles/tokens.css` in step with the design document and every stylesheet on the tokens.
- `npm run check:readme`: every dependency justified here, every script and gate step listed in this section, every relative link resolving.
- `npm run test:scripts`: the tests for every script, with `node --test`.
- `npm run terms:sync`: changes the confidential term list safely (see below).

The `gate` job in `.github/workflows/ci.yml` runs on every push and pull request, in this order:

1. **Check out full history**: every ref, so the scans see all of history.
2. **Restore confidential term list**: from a repository secret; fails closed if it is missing.
3. **Set up Node from .nvmrc**: the pinned Node version.
4. **Install dependencies**: `npm ci`.
5. **Lint**: `npm run lint`.
6. **Type check**: `npm run typecheck`.
7. **Script tests**: `npm run test:scripts`.
8. **Build**: `npm run build`.
9. **Token drift check**: `npm run check:tokens`.
10. **Repository scan (tree, every blob and commit message in history)**: `check-repo.mts --history`.
11. **Secret scan (gitleaks, full history)**: a checksum-pinned gitleaks binary.
12. **README check**: `npm run check:readme`.
13. **Branch protection check**: `main` still protected with `gate` required for everyone.

## One-time setup after cloning

```sh
git config core.hooksPath .githooks
```

Before every commit the hooks run the script tests, `scripts/check-repo.mts`, `scripts/check-tokens.mts` and `scripts/check-readme.mts`; the commit message goes through `scripts/check-repo.mts` too. The repository scan blocks planning files that are not on the publish allow-list, anything under `docs/`, `.claude/` or `_bmad/`, em dashes, and confidential terms read from an untracked local `.forbidden-terms` file.

## Working through pull requests

`main` is protected. Every change reaches it through a pull request, and the pull request merges only when the `gate` job in `.github/workflows/ci.yml` passes. Protection is strict (the branch must be up to date with `main` before merging) and applies to admins too, so there is no direct push to `main` for anyone.

The `gate` job also checks part of this protection on every run: its last step, `scripts/check-protection.mts`, fails unless `main` is protected, its required checks apply to admins too, and `gate` is among them. Those three are all the public branch endpoint shows; the pull request, strict and force push settings need an admin token to read and are not checked. Run `node scripts/check-protection.mts` to check it locally.

```sh
git switch -c <topic> main
# commit, through the hooks
git push -u origin <topic>
gh pr create --fill
gh pr checks --watch
gh pr merge --squash --delete-branch
```

When `main` moves while a pull request is open, strict protection blocks the merge until the branch is updated: `gh pr update-branch`, then wait for `gate` again.

Two repository settings keep this cheap:

- **Always suggest updating pull request branches**, so the update is one click (or `gh pr update-branch`).
- **Automatically delete head branches**, so merged branches do not pile up.

### Emergency path

1. **Production is broken:** roll back in Vercel to the previous production deployment (instant rollback). No commit is needed, and the gate is not involved.
2. **The fix:** goes through a pull request like any other change.
3. **The gate fails for a reason outside the change** (an outage at GitHub, npm or the gitleaks download): wait for the outage to pass, then re-run the job with `gh run rerun <run-id> --failed`. There is no bypass; production stays safe on the rolled-back deployment meanwhile.

## Changing the confidential terms

The confidential term list lives in three places: the local untracked `.forbidden-terms`, and the `FORBIDDEN_TERMS` secret in both the Actions and the Dependabot secret stores (runs started by Dependabot read only the second). Change it only like this.

Prerequisite: `gh auth login` as a user with admin rights on this repository, since writing repository secrets needs them. A `--dry-run` needs no `gh` at all.

```sh
# edit .forbidden-terms, then
npm run terms:sync -- --dry-run   # the guard alone; writes nothing
npm run terms:sync                # the guard, then both secrets
```

`scripts/terms-sync.mts` first runs `git fetch --prune origin`, then `scripts/check-repo.mts --history` against the edited list, over every local and remote-tracking branch. CI scans every blob and commit message in history, so a term that already matches history would turn every run red, and the only fix would be rewriting a public history. If anything matches, the script stops before writing any secret and names the commit and path. Only when the scan passes does it write both secrets with `gh secret set`, passing the file on stdin so the terms never appear in arguments or logs. Never set the secret by hand in the GitHub UI: the two stores and the local file would drift.

## Pinned versions

`.github/dependabot.yml` holds back TypeScript, `@types/node` and ESLint, with a reason for each, and `ci.yml` pins the gitleaks binary by version and checksum, which Dependabot does not track. Once a month `.github/workflows/pin-review.yml` runs `scripts/pin-review.mts`, which keeps one issue, "Dependency pins to review", current with the latest versions next to those pins. Close it after review; it comes back only when a major version, a peer range verdict or the gitleaks pin moves, not for patch releases. The report also carries the same protection reading, so relaxed protection is noticed even when nothing runs CI, and the registry expiry date of `shahrouzmohaghegh.com`, read over RDAP. The issue returns, led by an alert line, when protection drifts or cannot be read, or the domain is within 21 days of expiry, expired or unreadable, in case auto-renew or billing fails. `node scripts/pin-review.mts --print` shows the same report locally without touching the issue.

GitHub disables scheduled workflows in a public repository after 60 days without repository activity, and says so in the Actions tab. To turn the review back on, open Actions, select "Pin review" and choose "Enable workflow", or run `gh workflow enable pin-review.yml`. Running it once by hand (`gh workflow run pin-review.yml`) checks it still works.
