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

The site follows the islands paradigm: every page is server-rendered HTML, and client JavaScript exists only in named islands under `components/islands/`. The island register lives in [`ARCHITECTURE-SPINE.md`](_bmad-output/planning-artifacts/architecture/architecture-ShahrouzPortfolio-2026-09-25/ARCHITECTURE-SPINE.md) and is closed at two islands. `components/islands/reveal-on-scroll.tsx` (RevealOnScroll) is built: Home renders it, and it fades the evidence bands in as they scroll into view; the section rail is planned and not yet built. An island imports no content and no other island. `lib/` owns the shared logic between content and the page, such as the typed view of content and the filter, and like everything else imports nothing upward from `components/` or `app/` (AD-10 in the spine). Every design value lives in `styles/tokens.css`; no other stylesheet may use a literal colour or length, and `scripts/check-tokens.mts` enforces it.

```text
app/             Routes and layouts (Next.js App Router); composes components
components/      Server components; read content, never import upward
  islands/       The only client components, each named in the architecture
content/         Typed content as data; imports nothing from components/ or app/
public/          Static files served as they are: the hero portrait
lib/             Shared logic used by routes and components
styles/          tokens.css (every design value), breakpoints.css (the only breakpoint) and
                 reveal.css (the scroll reveal and the only print rule)
scripts/         Repository checks and tooling, in TypeScript, each with tests
.github/         The CI gate, the production watch, the monthly pin review and Dependabot settings
.githooks/       Local pre-commit and commit-msg hooks
_bmad-output/    The published subset of the planning documents
```

`content/ad-10-probe.ts` and `components/ad-6-probe.ts` are deliberate probes that keep the lint rules on import direction firing; they are not dead code. The second rule (AD-6) keeps `app/` and `components/` reading evidence only through `lib/evidence.ts`: it forbids importing `content/case-studies`, `content/projects` and `lib/evidence-types.ts` directly. AD-6 is about evidence, so the rest of `content/` is outside it.

`content/site.ts` holds the site-wide copy: the wordmark name, the footer (positioning line, location, availability, contact links and the note about the CV) and the lines Home reuses. Components import it directly. It sits under `content/`, so the content review box gates every change to it like any other content. `content/home.ts` holds Home's own copy the same way: the positioning statement, the kicker, the two figure-pair labels and figures, the portrait `alt`, the Explore link and the two evidence bands below the hero. `app/home.test.tsx` fails if the statement leaves 40 to 45 words, the hero order changes, a band gains or loses a piece or changes order, the hero becomes a reveal target, Home renders an island other than RevealOnScroll, a banned word reaches Home or `/` asks for `noindex` again while the empty route shells stop asking for it.

The scroll reveal works without hiding anything from a visitor who cannot run it. A section opts in with the global class `reveal`. `styles/reveal.css` hides it only under `.js-reveal`, a class RevealOnScroll adds to the root as its first action and never adds under `prefers-reduced-motion: reduce`, so with JavaScript off, with reduced motion and in print every band is at rest. A band's figure size comes from `lib/figure-role.ts`, the Figure demotion rule from the design document, implemented once.

Every route renders `components/site-frame.tsx` itself, passing its own nav item as `current`: one header with the primary nav, one main, one footer. `components/site-frame.test.tsx` renders every `app/**/page.tsx` and `app/not-found.tsx` and fails, by route, any that skips the frame or marks the wrong nav item.

## Adding an Evidence Item

Every Case Study and Project is defined once and read from there by every page, through the `EvidenceItem` type in `lib/evidence.ts`. Adding one takes three edits:

1. An entry in `content/case-studies/index.ts` or `content/projects/index.ts`: slug, title, one-line summary, one or more Capabilities, one Headline Metric and the `href` (`/experience/<slug>` or `/projects/<slug>`).
2. A new `<slug>.mdx` beside it, holding the prose.
3. The slug, in its place, in `DISPLAY_ORDER` in `lib/evidence.test.ts`.

A slug is lowercase kebab-case and unique across both collections. The order of entries in `index.ts` is the order they are shown in, and `DISPLAY_ORDER` pins that order, so adding, removing or reordering an item also means updating that list. The third edit is the reason this is three edits rather than the two-file record made earlier for NFR-8, which it supersedes: display order is a content decision, and the list is where it is confirmed on purpose rather than changed by a stray move in `index.ts`.

A Headline Metric without a qualifier (`qualifierNotRequired: true`) fails `npm run test` unless its slug is on the reviewed list `REVIEWED_UNQUALIFIED` in `lib/evidence.test.ts`; a slug goes there only after Shahrouz confirms the figure needs no scope. A dated claim is checked only when its date is written `YYYY-MM-DD` in a Headline Metric's value or qualifier; it then fails `npm run test` once it is more than 365 days old, until the claim is checked again and its date refreshed, and a date that is impossible or in the future fails too.

A pull request that changes anything under `content/` or `lib/evidence.test.ts` (which holds his reviewed lists) fails the gate until its description has the line `- [x] Shahrouz reviewed the content wording at COMMIT`, from `.github/pull_request_template.md`, where `COMMIT` is at least 7 characters of the latest commit in the pull request that changed those paths. A later content push makes the tick stale, and the failure names the commit to review. This is a procedural check, not proof of who reviewed: agents act through Shahrouz's login, so GitHub cannot tell who ticked the box. The agent never ticks it; only Shahrouz does, after reading the wording.

The first two edits are two files, not one, because metadata lives in TypeScript and prose in MDX (AD-5 in the spine). MDX exports and frontmatter are not type-checked, so keeping the metadata in TypeScript is what makes an unknown Capability, an empty Capability list or a metric without its qualifier fail `npm run typecheck`; the cases are pinned in `lib/evidence.type-test.ts`. `npm run test` then fails, naming the item, on an entry with no `.mdx`, an `.mdx` with no entry, a slug used twice across both collections, or an `href` that does not match the kind and slug. The split is revisited past about twenty items.

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
| `vitest` | Runs the application logic tests, starting with the content integrity suite; the scripts keep `node:test`. |

There is no component library, CSS framework or animation library. A dependency without a row here fails `scripts/check-readme.mts`.

## Checks

npm scripts:

- `npm run dev`: the local development server.
- `npm run build`: the production build (`next build`).
- `npm run start`: serves the production build.
- `npm run lint`: ESLint, including the import direction rule.
- `npm run typecheck`: `tsc --noEmit` over the site and the scripts.
- `npm run check:tokens`: keeps `styles/tokens.css` in step with the design document and every stylesheet on the tokens; fails any `opacity: 0` or `translateY` not scoped under `.js-reveal`, and any `@media print` outside `styles/reveal.css`.
- `npm run check:readme`: every dependency justified here, every script and gate step listed in this section, every relative link resolving.
- `npm run check:content-review`: on a pull request that changes anything under `content/` or `lib/evidence.test.ts`, fails unless the body has the `Shahrouz reviewed the content wording at COMMIT` box ticked with the latest commit that changed them; passes on any other event.
- `npm run test:scripts`: the tests for every script, with `node --test`.
- `npm run test`: the application logic tests, with Vitest: the content integrity suite in `lib/evidence.test.ts`, the Figure demotion suite in `lib/figure-role.test.ts`, the route frame suite in `components/site-frame.test.tsx`, the RevealOnScroll suite in `components/islands/reveal-on-scroll.test.ts` and the Home suite in `app/home.test.tsx`.
- `npm run terms:sync`: changes the confidential term list safely (see below).
- `npm run watch:production`: runs the production checks once against the live site and prints the result; touches no issue (see [Production watch](#production-watch)).

The `gate` job in `.github/workflows/ci.yml` runs on every pull request (including an edit to its description, so ticking the content review box re-runs it) and on every push to `main`; pushes to other branches do not run it, so a pull request's commit carries one `gate` result, from the pull request run, in this order:

1. **Check out full history**: every ref, so the scans see all of history.
2. **Restore confidential term list**: from a repository secret; fails closed if it is missing.
3. **Set up Node from .nvmrc**: the pinned Node version.
4. **Install dependencies**: `npm ci`.
5. **Lint**: `npm run lint`.
6. **Type check**: `npm run typecheck`.
7. **Script tests**: `npm run test:scripts`.
8. **Unit tests**: `npm run test`.
9. **Build**: `npm run build`.
10. **Token drift check**: `npm run check:tokens`.
11. **Repository scan (tree, every blob and commit message in history)**: `check-repo.mts --history`.
12. **Secret scan (gitleaks, full history)**: a checksum-pinned gitleaks binary.
13. **README check**: `npm run check:readme`.
14. **Content review check**: `npm run check:content-review`.
15. **Branch protection check**: `main` still protected with `gate` required for everyone; runs even when an earlier step fails.

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

CI runs on pull requests and on pushes to `main` only, so a topic branch gets no gate run until a pull request is open for it. Open a draft pull request early (`gh pr create --draft --fill`) to see the gate on every push.

When `main` moves while a pull request is open, strict protection blocks the merge until the branch is updated: `gh pr update-branch`, then wait for `gate` again.

Two repository settings keep this cheap:

- **Always suggest updating pull request branches**, so the update is one click (or `gh pr update-branch`).
- **Automatically delete head branches**, so merged branches do not pile up.

### Emergency path

1. **Production is broken:** roll back in Vercel to the previous production deployment (instant rollback). No commit is needed, and the gate is not involved.
2. **The fix:** goes through a pull request like any other change.
3. **The gate fails for a reason outside the change** (an outage at GitHub, npm or the gitleaks download): wait for the outage to pass, then re-run the job with `gh run rerun <run-id> --failed`. There is no bypass; production stays safe on the rolled-back deployment meanwhile.

## Production watch

Two layers tell Shahrouz when production breaks, so a visitor never has to.

- **In the repository:** four times an hour `.github/workflows/production-watch.yml` runs `scripts/production-watch.mts`. It checks that `https://shahrouzmohaghegh.com/` answers 200 with his name on the page; that `https://www.`, `http://` and `http://www.` each redirect (308) to it; and that the latest GitHub deployment in the `Production` environment, which Vercel records, has neither failed nor sat queued or in progress for over 30 minutes. A check must fail on three passes a minute apart to count, and an open issue closes only after three clean passes, so a blip changes nothing. While anything is wrong, one issue, "Production is down", stays open, assigned to Shahrouz and labelled `production`, listing the problems; it gets a comment only when the set of failing checks changes, and closes itself with a "Recovered" comment. Only issues and comments written by the GitHub Actions bot count, so nobody else can silence or close an alert. It needs no secret beyond the job's own token, and touches issues only inside GitHub Actions.
- **Outside it:** an UptimeRobot keyword monitor in Shahrouz's own account requests the apex every five minutes and alerts him by email when the page stops answering or no longer contains his name. It never pauses and does not depend on GitHub, which can delay or skip scheduled runs. Its configuration lives in that account, not here.

After a Vercel instant rollback the site recovers, but the deployment problem stays open until a new deploy succeeds, because the latest commit on `main` is not what is live.

To prove the alert path end to end, run `gh workflow run production-watch.yml -f simulate_failure=true`. It fails the apex check on purpose and opens a real issue, which the next scheduled run closes once three passes are clean.

GitHub disables scheduled workflows in a public repository after 60 days without commits. The watch's last step re-enables itself and the pin review through the API on every run, which resets that clock, so a quiet repository keeps both running. If one is ever disabled anyway, the Actions tab says so: open it, select the workflow and choose "Enable workflow", or run `gh workflow enable production-watch.yml`; then `gh workflow run production-watch.yml` checks it still works.

Both layers look for the exact text `Shahrouz Mohaghegh` on the page (`NAME` in `scripts/production-watch.mts` and the UptimeRobot keyword). A change to how the name appears in the HTML must update both in the same change, or both raise a false alarm. `npm run watch:production` runs the same checks locally and prints the result without touching any issue.

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

`.github/dependabot.yml` holds back TypeScript, `@types/node` and ESLint, with a reason for each, and `ci.yml` pins the gitleaks binary by version and checksum, which Dependabot does not track. Once a month `.github/workflows/pin-review.yml` runs `scripts/pin-review.mts`, which keeps one issue, "Dependency pins to review", current with the latest versions next to those pins. Close it after review; it comes back only when a major version, a peer range verdict or the gitleaks pin moves, not for patch releases. The report also carries the same protection reading, so relaxed protection is noticed even when nothing runs CI, the registry expiry date of `shahrouzmohaghegh.com`, read over RDAP, and whether `shahrouzmohaghegh/career-application-system` and `shahrouzmohaghegh/shahrouz-portfolio`, which the site claims are public repositories, still are. The issue returns, led by an alert line, when protection drifts or cannot be read, the domain is within 21 days of expiry, expired or unreadable, in case auto-renew or billing fails, or either cited repository is private, not found or unreadable. `node scripts/pin-review.mts --print` shows the same report locally without touching the issue.

GitHub disables scheduled workflows in a public repository after 60 days without repository activity, and says so in the Actions tab. To turn the review back on, open Actions, select "Pin review" and choose "Enable workflow", or run `gh workflow enable pin-review.yml`. Running it once by hand (`gh workflow run pin-review.yml`) checks it still works.
