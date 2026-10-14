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

The site follows the islands paradigm: every page is server-rendered HTML, and client JavaScript exists only in named islands under `components/islands/`. The island register lives in [`ARCHITECTURE-SPINE.md`](_bmad-output/planning-artifacts/architecture/architecture-ShahrouzPortfolio-2026-09-25/ARCHITECTURE-SPINE.md) and is closed at two islands. Both are built. `components/islands/reveal-on-scroll.tsx` (RevealOnScroll): Home renders it, and it fades the evidence bands in as they scroll into view. `components/islands/section-rail.tsx` (SectionRail): the case-study and project pages render it, and it marks the section being read. An island imports no content and no other island. `lib/` owns the shared logic between content and the page, such as the typed view of content and the filter, and like everything else imports nothing upward from `components/` or `app/` (AD-10 in the spine). Every design value lives in `styles/tokens.css`; no other stylesheet may use a literal colour or length, and `scripts/check-tokens.mts` enforces it.

```text
app/             Routes and layouts (Next.js App Router); composes components
components/      Server components; read content, never import upward
  islands/       The only client components, each named in the architecture
  case-study/    The content components a case study's MDX uses (server-rendered)
content/         Typed content as data; imports nothing from components/ or app/
public/          Static files served as they are: the hero portrait
lib/             Shared logic used by routes and components
styles/          tokens.css (every design value), breakpoints.css (the only breakpoint),
                 reveal.css (the scroll reveal and its print reset) and focus.css (the focus ring)
scripts/         Repository checks and tooling, in TypeScript, each with tests
.github/         The CI gate, the production watch, the monthly pin review and Dependabot settings
.githooks/       Local pre-commit and commit-msg hooks
_bmad-output/    The published subset of the planning documents
mdx-components.tsx  The components every MDX file can use (Section and the content components), required by @next/mdx
proxy.ts         The Next.js proxy: answers an unwritten case study or project with its not-found page and a 404
```

`content/ad-10-probe.ts` and `components/ad-6-probe.ts` are deliberate probes that keep the lint rules on import direction firing; they are not dead code. The second rule (AD-6) keeps `app/` and `components/` reading evidence only through `lib/evidence.ts`: it forbids importing `content/case-studies`, `content/projects` and `lib/evidence-types.ts` directly. AD-6 is about evidence, so the rest of `content/` is outside it.

`content/site.ts` holds the site-wide copy: the wordmark name, the footer (positioning line, location, availability, contact links and the note about the CV) and the lines Home reuses. Components import it directly. It sits under `content/`, so the content review box gates every change to it like any other content. `content/home.ts` holds Home's own copy the same way: the positioning statement, the kicker, the two figure-pair rows (number, words, scope), the portrait `alt`, the Explore link, the two evidence bands below the hero and the words around Selected work (its heading, the card CTA and the cross-link). `app/home.test.tsx` fails if the statement leaves 40 to 45 words, the hero order changes, a band gains or loses a piece or changes order, the hero or Selected work becomes a reveal target, Selected work stops rendering one card per case study in collection order, Home renders an island other than RevealOnScroll, a banned word reaches Home, `/`, `/experience` or `/projects` asks for `noindex` again, or the empty route shell (`/contact`) stops asking for it.

The scroll reveal works without hiding anything from a visitor who cannot run it. A section opts in with the global class `reveal`. `styles/reveal.css` hides it only under `.js-reveal`, a class RevealOnScroll adds to the root only after marking any band already in view as revealed, and never adds under `prefers-reduced-motion: reduce` (removing it if reduced motion switches on later), so with JavaScript off, with reduced motion and in print every band is at rest. A band's figure size comes from `lib/figure-role.ts`, the Figure demotion rule from the design document, implemented once.

Selected work on Home renders one `components/evidence-card.tsx` per case study, in collection order. `app/page.tsx` passes `caseStudyItems` from `lib/evidence.ts` whole and lists no item itself, so adding or removing a case study changes Home with no edit there; the Home suite proves it with a mocked collection. The card reads only `EvidenceItem` and `CAPABILITY_NAME` (each capability's full name) from `lib/evidence.ts`, never `content/`, so Epic 3's listings can reuse it; its CTA words and its title's heading level (`h3` under Home's Selected work, `h2` on a listing) come from the surface that renders it. `components/evidence-card.test.tsx` checks its order, its two links to one `href`, the heading level, the metric and qualifier as one sentence and the eyebrows in canonical order. Every grid of cards is `components/card-grid.tsx`, three columns from 768px and one below, so Home and the listings share one grid.

`/experience` lists every case study: the `h1`, one intro line, then one card per case study in collection order, with titles as `h2`. Its words (heading, intro and CTA) live in `content/experience.ts`, under the content review box. `app/experience/page.tsx` passes `caseStudyItems` whole, like Home, and stays static with no island. Its `metadata.title`, and that of `/projects`, comes from `listingTitle` in `lib/evidence.ts`, the one place a listing's title is made; it returns the bare name and the root layout's template adds the site name once. `app/experience/experience.test.tsx` checks the order, the heading outline, the mocked collection change, the titles and that the route asks for no `noindex`. `/projects` is the same listing for projects (Story 3.5), with the same styles and grid: its words (heading, meta description, intro and the CTA "Read the project") live in `content/projects-page.ts`, and `app/projects/projects.test.tsx` checks it the same way.

Every focusable element shows one focus ring, drawn by `styles/focus.css`: a 2px outline at a 2px offset on `:focus-visible`, in `--focus-ring`. That defaults to the light-ground ring; a deep ground (the deep evidence band) sets it to the on-deep ring, so the colour follows the ground behind the element, not its own fill.

`/experience/<slug>` is one case study in full (Story 3.2), generated at build only for a case study on `writtenCaseStudySlugs`, the committed list of written case studies in `content/case-studies/index.ts`. Any other slug, an empty `.mdx` or an unknown one, gets the case-study not-found page with a real 404 through the root `proxy.ts` (AD-23 note of 2026-10-12): Next.js 16.3.8 renders a segment `not-found.tsx` only on the client, which leaves it blank with JavaScript off, so the proxy rewrites, with status 404, to the static `app/case-study-not-available/page.tsx`, whose full HTML renders without script and asks for noindex; its own URL answers 404 too. The decision lives in `lib/not-found-rewrite.ts`, which reads only the written list, so the proxy carries no MDX and reads no file; `lib/not-found-rewrite.test.ts` covers it. `app/experience/[slug]/not-found.tsx` stays as the fallback for a direct `notFound()` in the page. The page is the header from the Evidence Item (the eyebrow "Case study" and each capability's full name, the title as `h1`, the summary as dek), then SectionRail beside the body, then a link to the next written case study in collection order, wrapping to the first and left out when only one is written. The body is the slug's `.mdx`, compiled by `@next/mdx` and loaded through `evidenceBody` in `lib/evidence.ts`; `writtenItems` there reads each kind's written list, and `nextWrittenItem` picks the next one. The integrity suite fails while that list and the non-empty `.mdx` files disagree, so writing a case study means adding its slug to the list in the same change. A written `.mdx` holds exactly five `<Section name="...">` blocks, in order: `context`, `decisions`, `actions`, `outcome`, `lessons`. `mdx-components.tsx` hands every MDX file the `Section` component (`components/mdx-section.tsx`), which renders a focusable `<section>` with its `h2`, the label taken from `CASE_STUDY_SECTIONS` in `lib/evidence.ts`, the one list the headings, the rail and the integrity suite read; the suite fails, naming the slug, any written `.mdx` whose sections are missing, extra or out of order. The route's words live in `content/case-study-page.ts`. The not-found treatment is `components/detail-not-found.tsx`, shared with the project route. `app/experience/[slug]/case-study.test.tsx` checks all of this against a mocked collection with fixture bodies, then renders the three written case studies for real (see Writing a case study below).

SectionRail is a `<nav aria-label="Sections of this case study">` inside `main`: the label "On this page", then an ordered list of in-page anchors numbered 01 to 05 by a CSS counter. On a project it takes `groups` instead: each group is a `<p>` label (never a heading) before its own list, and the counter, reset once on the nav, runs 01 to 08 through all three; whatever it is given as children (the repository link) sits at the foot, and the script never marks it. With JavaScript off it is a plain, working contents list and no anchor is marked. With script, an IntersectionObserver keeps `aria-current="true"` on exactly one anchor (the last section overlapping the top 40 percent of the viewport), and an activated anchor moves focus to its section. From 768px it is sticky beside the body; below that it is a static panel box above the body, through the `--component-section-rail-*` and `--component-case-study-columns` pairs in `styles/breakpoints.css`. The logic is `startSectionRail`, given its nav, document, window and observer, and is tested in `components/islands/section-rail.test.ts` the way RevealOnScroll is.

Every route renders `components/site-frame.tsx` itself, passing its own nav item as `current`: one header with the primary nav, one main, one footer. `components/site-frame.test.tsx` renders every `app/**/page.tsx` and every `not-found.tsx` and fails, by route, any that skips the frame or marks the wrong nav item; it renders each dynamic route for a slug it treats as written.

`/projects/<slug>` is one project in full (Story 3.5), built the same way as a case study, with the same styles: generated only for a project on `writtenProjectSlugs` in `content/projects/index.ts`, which is empty until Story 3.7 writes the prose, so for now every project URL gets the project not-found page ("This project is not available.", then Projects, Experience and Home) with a real 404, through the same proxy and `lib/not-found-rewrite.ts`, rewritten to the static `app/project-not-available/page.tsx`. A written project's `.mdx` holds exactly eight `<Section name="...">` blocks, in order: `problem`, `approach`, `decisions`, `technologies`, `tradeoffs`, `testing`, `outcome`, `lessons`, from `PROJECT_SECTIONS` in `lib/evidence.ts`, which groups them for the rail under "The build", "What it cost" and "What came of it"; the integrity suite checks each kind against its own list. The page is the header (the eyebrow "Project", each capability's full name, the title as `h1`, the summary as dek), then the repository call to action, then the grouped rail beside the body, then "Next project". A project's `repository` (in its `index.ts` entry, a project only) drives `components/repo-cta.tsx`: one `<a>` on a solid accent fill with the full URL as visible text, and, from 768px, its repeat at the foot of the rail with the same accessible name (below 768px the rail sits straight under the panel, so the repeat is hidden there); a project without one renders neither. The accent fill is allowed on this route only, and `app/projects/projects.test.tsx` renders every other route and fails if the call to action's classes appear on any. The route's words live in `content/project-page.ts`. The same suite fails a written project whose Technologies list puts Python beside C#, C++, SQL, KQL or TypeScript.

## Adding an Evidence Item

Every Case Study and Project is defined once and read from there by every page, through the `EvidenceItem` type in `lib/evidence.ts`. Adding one takes three edits:

1. An entry in `content/case-studies/index.ts` or `content/projects/index.ts`: slug, title, one-line summary, one or more Capabilities, one Headline Metric and the `href` (`/experience/<slug>` or `/projects/<slug>`).
2. A new `<slug>.mdx` beside it, holding the prose.
3. The slug, in its place, in `DISPLAY_ORDER` in `lib/evidence.test.ts`.

An item gets its page only once its `.mdx` is written; the change that writes it also adds the slug, in collection order, to `writtenCaseStudySlugs` in `content/case-studies/index.ts` or `writtenProjectSlugs` in `content/projects/index.ts`, and `npm run test` fails until both agree. A project may also carry a `repository`, which its page links to. It must be `https://github.com/shahrouzmohaghegh/<kebab-case name>`, and adding, changing or removing one also means updating the pinned repositories test ("the reviewed repositories") in `lib/evidence.test.ts`.

A slug is lowercase kebab-case and unique across both collections. The order of entries in `index.ts` is the order they are shown in, and `DISPLAY_ORDER` pins that order, so adding, removing or reordering an item also means updating that list. The third edit is the reason this is three edits rather than the two-file record made earlier for NFR-8, which it supersedes: display order is a content decision, and the list is where it is confirmed on purpose rather than changed by a stray move in `index.ts`.

A Headline Metric without a qualifier (`qualifierNotRequired: true`) fails `npm run test` unless its slug is on the reviewed list `REVIEWED_UNQUALIFIED` in `lib/evidence.test.ts`; a slug goes there only after Shahrouz confirms the figure needs no scope. A dated claim is checked only when its date is written `YYYY-MM-DD` in a Headline Metric's value or qualifier; it then fails `npm run test` once it is more than 365 days old, until the claim is checked again and its date refreshed, and a date that is impossible or in the future fails too.

A pull request that changes anything under `content/` or `lib/evidence.test.ts` (which holds his reviewed lists) fails the gate until its description has the line `- [x] Shahrouz reviewed the content wording at COMMIT`, from `.github/pull_request_template.md`, where `COMMIT` is at least 7 characters of the latest commit in the pull request that changed those paths. A later content push makes the tick stale, and the failure names the commit to review. This is a procedural check, not proof of who reviewed: agents act through Shahrouz's login, so GitHub cannot tell who ticked the box. The agent never ticks it; only Shahrouz does, after reading the wording.

The first two edits are two files, not one, because metadata lives in TypeScript and prose in MDX (AD-5 in the spine). MDX exports and frontmatter are not type-checked, so keeping the metadata in TypeScript is what makes an unknown Capability, an empty Capability list or a metric without its qualifier fail `npm run typecheck`; the cases are pinned in `lib/evidence.type-test.ts`. `npm run test` then fails, naming the item, on an entry with no `.mdx`, an `.mdx` with no entry, a slug used twice across both collections, or an `href` that does not match the kind and slug. The split is revisited past about twenty items.

### Writing a case study

A written `.mdx` is five `<Section name="...">` blocks and nothing else (see the case-study route above). Inside a section, write Markdown prose (paragraphs, lists, `**strong**`, `*emphasis*`, links, `>` blockquotes, all styled by `components/mdx-section.module.css`) and these components from `mdx-components.tsx`, which need no import. Each lives in `components/case-study/`, is a server component built from its DESIGN.md entry and uses tokens only:

- `<FactsStrip facts={[{ term, value }]} />`: a definition list of facts, side by side while each has room, stacked in a narrow column.
- `<TradeoffList>` holding one `<TradeoffPair decision buys costs />` per decision: the decision as an `h3`, then "What it buys" and "What it costs", each labelled in words, side by side while each has room and stacked buys first below that, costs under a 2px ink rule, never the accent. Optional children give the reasoning.
- `<OutcomeBand tag figure qualifier />`: the result on the deep ground inside the Outcome section (not full bleed). The figure and its qualifier are one sentence; the qualifier is required, starts in lower case and ends with a full stop, so a bare figure fails the type check and the render. The figure's type role comes from `lib/figure-role.ts`. The band sets the on-deep focus ring.
- `<SourceNote instrument weakness />`: where the number came from and how far to trust it, both required as full sentences.
- `<KeyValueList rows={[{ term, value }]} />`: repeats every number on the page with its scope.
- `<RetrievalDiagram />`: the original diagram of how the governed retrieval layer decides (Story 3.4, FR-36), used once, in the AI-native case study's Actions section after the retrieval-layer bullet. One question asked in two states, while a temporary exception is in force and after its expiry with the index unchanged; in each, both candidate sources go through three separate gates (Relevant, Authority, In force), each answered in words, and the answer inverts when only the date moves. It is a `<figure>` whose visible `<figcaption>` is the text alternative, each state an `h3` and a `<ul role="list">` of the two candidates (unordered, since their order is not a ranking) with their gates as a `<dl>`, then "Answer:" and the winning guidance, then one line on what similarity alone would return. No table semantics, image, SVG or script; glyphs are `aria-hidden`; no accent. The states stack below 768px and sit side by side while each has 14em (the `--component-retrieval-diagram-columns` pair). It takes no props: every word lives in `content/retrieval-diagram.ts`, under the content review box.

`components/case-study/case-study-components.test.tsx` covers each component. The case-study suite compiles every written `.mdx` with `@mdx-js/mdx` and renders it inside the real page, then fails on: a confidential term from `.forbidden-terms` (which must hold at least one), an em dash, "Team Lead", "CIO", a board peer's title (abbreviated or spelled out), "Secure Score" or a departure, in the rendered page (text, `alt`, `aria-label`, `title`, `href` and the `<head>`), the `.mdx`, `content/case-studies/index.ts`, `content/case-study-page.ts` or `content/retrieval-diagram.ts`, naming the file and line but never the term; a number the key-value list does not repeat; a percentage without its scope and source in the same sentence; AI vocabulary before the measured outcome on the AI-native case study (FR-33, see below); "Ralph loop" without a gloss; a Decisions section without labelled trade-off pairs; the AI-native page holding anything but exactly one `<figure>`, the retrieval diagram missing from its Actions section, placed before the retrieval-layer bullet, without its caption, or answering the same in both states; table semantics or a figure on any other case study; an Outcome without the band, then the source note, then the list; and any `[I'll supply: ...]` marker (straight or curly apostrophe) left in a written `.mdx` or in `content/case-studies/index.ts`, which only Shahrouz fills, so a draft cannot merge until he has. The AI-vocabulary check reads the whole of `main`, leaving out only the page title and the capability name, which are labels rather than claims; the dek may use AI vocabulary only after a figure of its own. `lib/not-found-rewrite.test.ts` checks that the proxy lets every slug on `writtenCaseStudySlugs` through.

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
| `@next/mdx` | Compiles each Evidence Item's `.mdx` prose at build (AD-5), so the prose renders as server components with no runtime MDX. |
| `@mdx-js/loader` | The MDX compiler `@next/mdx` runs as its loader; a required peer of it. |
| `@mdx-js/react` | The MDX component provider `@next/mdx` names as a required peer; the App Router itself takes components from `mdx-components.tsx`. |
| `@mdx-js/mdx` | The MDX compiler `@next/mdx` runs at build, called directly by the case-study suite so it renders each written `.mdx` through the real components in Vitest. |
| `@types/mdx` | Types for importing `.mdx` files and for `mdx-components.tsx`. |
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
- `npm run check:tokens`: keeps `styles/tokens.css` in step with the design document and every stylesheet on the tokens; fails any `opacity: 0`, `visibility: hidden` or translate not scoped under `.js-reveal`, a `styles/reveal.css` that stops restoring `.js-reveal .reveal.in` under the class names RevealOnScroll exports, any `@media print` outside `styles/reveal.css` and `styles/print.css` (the detail-page print rules, not yet written), any focus indicator removed or flattened (an `outline` of none or hidden, a zero `outline` or `outline-width`, an `outline-style` of none or hidden, or a zero `outline-offset`), and an `app/layout.tsx` that stops importing `styles/focus.css` after `styles/reveal.css`.
- `npm run check:readme`: every dependency justified here, every script and gate step listed in this section, every relative link resolving.
- `npm run check:content-review`: on a pull request that changes anything under `content/` or `lib/evidence.test.ts`, fails unless the body has the `Shahrouz reviewed the content wording at COMMIT` box ticked with the latest commit that changed them; passes on any other event.
- `npm run test:scripts`: the tests for every script, with `node --test`.
- `npm run test`: the application logic tests, with Vitest: the content integrity suite in `lib/evidence.test.ts`, the Figure demotion suite in `lib/figure-role.test.ts`, the route frame suite in `components/site-frame.test.tsx`, the evidence card suite in `components/evidence-card.test.tsx`, the RevealOnScroll suite in `components/islands/reveal-on-scroll.test.ts`, the SectionRail suite in `components/islands/section-rail.test.ts`, the Home suite in `app/home.test.tsx`, the Experience listing suite in `app/experience/experience.test.tsx`, the case-study detail suite in `app/experience/[slug]/case-study.test.tsx`, the projects suite in `app/projects/projects.test.tsx` and the not-found rewrite suite in `lib/not-found-rewrite.test.ts`.
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

- **In the repository:** four times an hour `.github/workflows/production-watch.yml` runs `scripts/production-watch.mts`. It checks that `https://shahrouzmohaghegh.com/` answers 200 with his name on the page; that `https://www.`, `http://` and `http://www.` each redirect (308) to it; that a case-study URL that will never exist and `https://shahrouzmohaghegh.com/case-study-not-available` each answer 404 with the h1 "This case study is not available." in the HTML, and that a project URL that will never exist and `https://shahrouzmohaghegh.com/project-not-available` each answer 404 with the h1 "This project is not available.", so a Next.js change that brought back a blank or 200 not-found page (see the proxy under How it is structured) is caught on the live server; and that the latest GitHub deployment in the `Production` environment, which Vercel records, has neither failed nor sat queued or in progress for over 30 minutes. A check must fail on three passes a minute apart to count, and an open issue closes only after three clean passes, so a blip changes nothing. While anything is wrong, one issue, "Production is down", stays open, assigned to Shahrouz and labelled `production`, listing the problems; it gets a comment only when the set of failing checks changes, and closes itself with a "Recovered" comment. Only issues and comments written by the GitHub Actions bot count, so nobody else can silence or close an alert. It needs no secret beyond the job's own token, and touches issues only inside GitHub Actions.
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
