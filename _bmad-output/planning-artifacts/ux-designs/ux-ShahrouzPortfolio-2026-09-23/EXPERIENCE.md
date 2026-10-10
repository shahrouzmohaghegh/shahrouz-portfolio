---
title: ShahrouzPortfolio Experience
status: final
created: 2026-09-23
updated: 2026-10-07
sources:
  - _bmad-output/planning-artifacts/prds/prd-ShahrouzPortfolio-2026-09-23/prd.md
  - _bmad-output/planning-artifacts/briefs/brief-ShahrouzPortfolio-2026-09-23/brief.md
  - _bmad-output/planning-artifacts/briefs/brief-ShahrouzPortfolio-2026-09-23/addendum.md
  - DESIGN.md
  - .memlog.md
  - mockups/screen-home.html
  - mockups/screen-experience.html
  - mockups/screen-case-study.html
  - mockups/screen-ai-case-study.html
  - mockups/screen-contact.html
  - mockups/screen-project.html
  - mockups/diagram-system.html
  - photography-brief.md
---

# ShahrouzPortfolio, Experience Spine

Peer contract to `DESIGN.md`. This file owns how the site works: information architecture, behaviour, states, interactions, accessibility and journeys. Visual specification lives in `DESIGN.md` and is referenced here by token name in `{path.to.token}` form. Both spines win over any mockup in `mockups/`. Where a mockup disagrees with a spine, the mockup is stale. Earlier exploration in `.working/` is historical record only and carries no authority.

Product content (requirements, capability definitions, journeys, confidentiality rules) is inherited by reference from the PRD and brief in the `sources` block above. It is not restated here.

## Foundation

Single-surface responsive web, statically generated except the two filtered listings (NFR-6 declared exemption, AD-4), **mobile-primary**. UJ-1 happens on a phone on mobile data, so 375px is the design case and 1440px is the expansive one, not the reverse.

No UI system, no component library, no CSS framework, no animation library. Plain CSS or CSS Modules. TypeScript `strict`, one typed content collection behind every surface. Every dependency is justified by a requirement.

No accounts, no authentication, no roles, no server state. One visitor type. The single interactive feature in V1 is the capability filter; everything else is content and links.

The site is an **impression surface**. The resume carries completeness, so every surface here is allowed to be selective, and the cost of looking unconsidered is higher than the cost of omitting something.

## Information Architecture

Six routes, flat, each reachable in one interaction from anywhere.

| Surface | Reached from | Purpose |
|---|---|---|
| `/` Home | Direct link, LinkedIn, nav wordmark | Identity, positioning, availability, evidence bands, selected work preview, routes into depth |
| `/experience` | Nav, Home CTA, Home cross-link | Case study listing with the capability filter |
| `/experience/[slug]` | Card, filtered card, next-case link | Case study detail: Context, Decisions, Actions, Outcome, Lessons |
| `/projects` | Nav, cross-listing link from `/experience` | Project listing with the same capability filter |
| `/projects/[slug]` | Card, filtered card | Project detail: Problem, Approach, Decisions, Technologies, Trade-offs, Testing, Outcome, Lessons, repository link |
| `/contact` | Nav, footer, any surface | Email and LinkedIn. No contact form, no CV download |

Navigation is a flat list in the header plus a three-column footer that repeats Evidence and Contact links. No drawer, no mega menu, no breadcrumbs, no sticky header. Contact is reachable from every route by requirement.

The capability filter spans `/experience` and `/projects` on **one shared URL parameter**, so a selection survives moving between them. There is no combined `/evidence` route. There is no `/ai-engineering` route in V1; AI evidence lives inside case studies and projects, which is also what keeps the site from leading with AI.

Composition reference: `mockups/screen-home.html`, `mockups/screen-experience.html`, `mockups/screen-case-study.html`, `mockups/screen-ai-case-study.html`, `mockups/screen-contact.html`, `mockups/screen-project.html`. Spines win on conflict.

## Voice and Tone

Microcopy only. Brand voice and aesthetic posture live in `DESIGN.md.Brand and Style`.

| Do | Don't |
|---|---|
| "Open to conversations about the next role." standing alone | Any explanation of why, in any words |
| "Showing 1 of 3 case studies, filtered by Engineering Leadership." | "1 result" |
| "No case study is tagged Hands-On. Hands-on evidence is carried by the systems themselves, so it lives on Projects." | "No results found" |
| "2 Projects also match Hands-On" | "See also" |
| "Cycle time down 30 to 40% across pilot projects" | "Cycle time down 30 to 40%" |
| "DORA-informed, adapted for AI-assisted delivery" | "We used DORA" |
| "Bad fixes on the 26-person team I hired and ran" | Any attribution of that figure to the 38-person function |
| "There is no CV on this site, and that is deliberate." | Leaving the absence unexplained |
| "Read the case study" | "Learn more", "Click here", "Discover" |
| Numbers, mechanisms and trade-offs | Adjectives, achievement statements, breathlessness about AI |

Hard rules, binding on every word rendered: **no em dashes anywhere**. First person used sparingly. Never imply engineering headcount above 38. Every metric carries its qualifier in the same sentence as the number, including inside `{components.outcome-band}` and `{components.evidence-band}`.

## Evidence and Attribution Discipline

Product-specific section. These rules are behavioural, enforced in content and in CI, and they outrank layout convenience.

1. **Open, goes to John: One qualifier, one sentence.** The content model carries an optional qualifier on every headline metric so a figure cannot render bare. Any surface that displays a metric displays its qualifier with it.
2. **The 26 and the 38 are distinct.** The Fault Feedback Ratio turnaround, shown in the Quality band and on CS-1, belongs to the 26-person team he hired and ran, which was part of the 38-person function and not additional to it. The case study states this three times in identical words: in the dek, in `{components.outcome-band}`, and in `{components.source-note}`.
3. **Sources are stated before they are asked for.** Telemetry-derived figures and self-reported figures are labelled as such. A deliberately favourable sample is named as one.
4. **Illustrative values are labelled.** The worked similarity values in the decision table (0.91, 0.87, 0.93) are internally consistent but not measured. The production page must say so.
5. **Open, low risk: Leadership leads, AI never leads.** Home leads with leadership and delivery outcomes. The chip order is fixed and AI-Native is never first.

## Component Patterns

Behavioural. Visual specification lives in `DESIGN.md.Components`.

| Component | Use | Behavioural rules |
|---|---|---|
| Primary nav `{components.nav}` | Every route | Three items only: Experience, Projects, Contact. The wordmark is the link to Home. Real `href` on every item, keyboard operable, `aria-current="page"` on the current route. Not sticky. **No disclosure menu at any width**: three short items fit inline at 375px, so the nav is identical at every breakpoint |
| Hero plate `{components.hero-plate}` | Home, Contact, hands-on passage | Decorative framing, informative `alt`. Never a link, never a lightbox, never a carousel. Desktop and mobile are two `object-position` crops of one file via `object-fit: cover`, never two pre-cropped assets. Explicit `width`/`height` so no layout shift |
| Call to action `{components.cta-link}` | Home hero, cross-links, next-case link | A link, not a button. One per surface at most |
| Evidence band `{components.evidence-band}` | Home | Static content, one figure and one caption. **Two bands on Home, not three:** Quality and Security posture. The former Scale band is retired because it restated the 38-person figure already in the positioning paragraph, which amended FR-5 now forbids. Reveals on scroll within the motion ceiling. Present in the DOM and readable with JavaScript off |
| Figure pair `{components.figure-pair}` | Home, above the fold | Two stacked rows, each a phrase: the number in bold serif, then what it measures in regular serif, then the scope underneath in small muted type. No caps label. **Never a reveal target**, because it sits above the fold and above-fold content is never hidden. Static, present in the DOM, and depends on no late-loading asset. Carries FR-5's two required figures, people then speed, and no others |
| Capability chip `{components.capability-chip}` | `/experience`, `/projects` | Fixed order: Leadership, AI-Native, Executive Influence, Hands-On. Multi-select, OR logic, toggle on activation. **Every chip is an `<a href>`, never a `<button>`, and `aria-pressed` appears nowhere.** Selected state is exposed by `aria-current="true"` plus visually hidden text. Full markup and URL contract in Capability Filter Contract below. Chips are the short labels; the full capability name is used in headings, on cards and in the state line |
| State line `{components.state-line}` | Directly under the chips | Always rendered, including unfiltered. States the count, the filter applied, and the cross-route count. **It is a focus target, not a live region.** Announcement mechanism and exact strings in Capability Filter Contract below |
| Cross-listing link | Under the state line, and first inside the empty state | States the other route's matching count and carries the selection across on the shared parameter |
| Evidence card `{components.evidence-card}` | Listings, Home preview | Whole title is the link. Capability eyebrow in full-name form. Exactly one headline metric with its qualifier. Not clickable as a whole block |
| Empty state `{components.empty-state}` | Either listing | Explains why the route is empty, leads with the cross-listing link, then offers clearing the filter. Never a blank container, a spinner or a bare no-results |
| Sequence `{components.sequence-stage}` | Case studies, project detail | One component rendered from a dataset. Identical ordered-list markup at every width, so order survives CSS being off. Stages are numbered, not colour-coded. A written text alternative is rendered on the page, not hidden |
| Decision table `{components.decision-table}` | AI-native case study | A real `<table>` with real row and column headers in both layouts. Two states of the same candidate set, read left to right as independent tests rather than as pipeline stages. Verdict is glyph plus text. A rendered text alternative accompanies it |
| Facts strip `{components.facts-strip}` | Case study, project detail | A definition list. Stacks vertically at 375px with a rule between rows |
| Section rail `{components.section-rail}` | Case study, project detail | In-page anchors, sticky on desktop, a static panel above the body on mobile. Current section marked in colour, in weight, and with `aria-current="true"` on the current anchor. Anchor targets receive focus on activation. Five items on a case study, eight on a project detail, numbering continuous |
| Rail group header `{components.rail-group-header}` | `/projects/[slug]` | Not a link and not a tab stop. A `<p>` inside the rail `<nav>`, before the run of items it names, so eight sections read as three. The three headers are The build, What it cost, What came of it. It must not be a heading tag: it would enter the document outline as a peer of the section headings it only groups in the rail. Numbering is never reset by a header. Used only when a rail carries more than six items |
| Trade-off pair `{components.tradeoff-pair}` | Case study Decisions, `/projects/[slug]` Trade-offs | Two `<div>`s inside one list item, each opened by a visible caps label, What it buys then What it costs. The labels are real text, so the meaning survives the columns stacking, CSS being off, and a reader who cannot tell the two rules apart. Never colour-coded. At 375px it stacks to one column, buys first, and no content is dropped |
| Repository call to action `{components.repo-cta}`, `{components.repo-cta-rail}` | `/projects/[slug]` only | The whole panel is a single `<a>`, not a panel containing a link, so there is one tab stop and one target. The full URL is visible text inside it, not only an `href`. The rail repeat carries the same `href` and the same accessible name, so a screen-reader link list shows one repeated destination and not two mystery links. Both take `{colors.focus-ring}` because both sit on light grounds. Link integrity is a launch-blocking check per Flow 3 |
| Outcome band `{components.outcome-band}` | Case study, project detail | Lifts the headline figure out of the prose with its qualifier attached |
| Key and value list `{components.kv-list}` | Case study, project detail | Repeats every number for a reader who skipped the prose |
| Source note `{components.source-note}` | Beneath each outcome | States the instrument and its weakness |
| Contact routes `{components.contact-hero}` | `/contact`, footer | Exactly two: `mailto:` and LinkedIn. Email is lightly obfuscated against naive scrapers in a way that does not impede a human or a screen reader. No form, no backend, no third-party service |
| Footer `{components.footer}` | Every route | Positioning line, location, availability, evidence links, contact links, and the standing note that there is no CV download |

## Capability Filter Contract

Product-specific section, and the most specification-dense part of the build. FR-16 to FR-21 depend on it, and every previous version of this contract was ambiguous in a way that produced a wrong implementation. Nothing here is a preference.

### Markup: chips are links

| Decision | Specification |
|---|---|
| Element | `<a href>` inside `<li>`. **Never `<button>`** |
| Why not a button | A button needs JavaScript to navigate. That loses the JS-off render, the pasteable URL in Flow 4, the deep-link restoration in State Patterns and the static generation of every filter combination. Four requirements against one attribute |
| Group | `<ul role="group" aria-labelledby="capfilter">`, where `#capfilter` is the visible `<p>` reading **Filter by capability**. A `<ul>` alone is a list, not a group, and gives the set no accessible name |
| Unselected chip | `<a class="chip" href="...">Leadership</a>` and nothing else |
| Selected chip | `<a class="chip" href="..." aria-current="true"><span class="ck" aria-hidden="true">&#10003;</span>Leadership<span class="sr">, selected</span></a>` |
| `aria-pressed` | **Removed everywhere.** `aria-pressed` is only mapped on `role="button"`. On an `<a href>`, which is `role="link"`, browsers ignore it and no screen reader announces it. It is inert markup that reads as a working mechanism, and axe does not flag it |
| Selected state, non-visually | Two signals, both kept: `aria-current="true"` for the programmatic layer, and the visually hidden `, selected` for the textual layer. The hidden text is **belt and braces and is not to be removed as superfluous.** It is what actually carried the state before `aria-current` was specified, and support for `aria-current="true"` on a link varies by screen reader |
| Selected state, visually | Oxide fill, check glyph, hidden text. Three signals, per the no-colour-alone rule |
| Chip `href` | Always **the selection this chip would produce**, which is the current selection with this capability toggled in or out, serialised canonically per the table below. A selected chip's `href` is therefore the selection minus itself |

### URL contract

One parameter, `capability`, shared by `/experience` and `/projects`, so a selection survives moving between them.

| Case | URL |
|---|---|
| No selection | `/experience` |
| One capability | `/experience?capability=leadership` |
| Several capabilities | `/experience?capability=leadership,executive-influence` |
| All four | `/experience?capability=leadership,ai-native,executive-influence,hands-on` |
| Carried across routes | `/projects?capability=leadership,executive-influence` |

Rules, all binding:

1. **One parameter, comma separated.** Never repeated parameters (`?capability=a&capability=b`), never a second parameter name, never a JSON or bracket form. The comma is not percent-encoded; `,` is legal in a query value and an encoded `%2C` must also be accepted on read.
2. **Slugs are fixed:** `leadership`, `ai-native`, `executive-influence`, `hands-on`. Lower case, hyphenated, and these four strings are canonical for the life of the site.
3. **Canonical order is the chip order:** Leadership, AI-Native, Executive Influence, Hands-On. Every URL the site emits serialises the selection in that order regardless of the order the user clicked, so two equivalent selections produce exactly one URL. This matters for shareability and for AD-3's title uniqueness, not for rendering.
4. **Empty means absent.** With nothing selected the parameter is omitted. `?capability=` is never emitted, and on read it is treated as no selection.
5. **Reading is liberal, writing is canonical.** A pasted URL with the values out of order, duplicated, mixed in case, or carrying an unknown slug is accepted: unknown slugs are dropped, duplicates collapsed, case folded, and the view renders the valid remainder. The chips then emit canonical `href`s, so the next click normalises the URL. A URL whose values are all unknown renders as unfiltered, not as empty.
6. **OR logic, never AND.** The result set is the union of the selected capabilities. Stated because the comma reads as an intersection to most developers.
7. **There are two listing routes, `/experience` and `/projects`, and both render dynamically.** There is no set of pre-rendered filter combinations. A route that accepts search params is ineligible for static generation in the App Router, and `generateStaticParams` does not override that. Neither route fetches anything: the filter is a pure function over local content, evaluated on the server per request in microseconds. Governed by ARCHITECTURE-SPINE AD-4, which rejected sixteen static pages behind an optional catch-all because it creates a duplicate-content problem requiring canonical tags. Nothing in this contract depends on the rendering mode.

### Announcement of the result count

**Mechanism: focus moves to the state line. There is no live region anywhere in the filter.**

`role="status"` and `aria-live` are removed from `{components.state-line}`. The mockups render `role="status"` and it does nothing: a live region only announces a **mutation to a region that already exists** in the accessibility tree. Filtering here is navigation, so the region is destroyed and recreated with the new document rather than mutated, and nothing is announced. This is true of a full page load and equally true of a client-side route change that replaces the subtree. It is invisible to automated audits, because axe sees a valid `role="status"` and passes it.

The rejected alternative, for the record: **keep a live region and never unmount it.** That requires the region element to live outside the swapped subtree and only ever have its `textContent` replaced. It is rejected because it is the more fragile of the two under exactly the conditions this project has. It depends on JavaScript for the announcement, which contradicts filtering being navigation; it breaks silently the first time anyone re-renders the containing `<section>`, which is the natural implementation; and it cannot be verified by any automated check, so a regression is invisible. Focus movement, by contrast, is verifiable in one manual keyboard pass.

Specification:

| Aspect | Rule |
|---|---|
| Target | The state line: `<p class="stateline" id="filter-status" tabindex="-1">`. It sits directly under the chip group and above the cards, so it is also the correct reading position |
| `tabindex` | `-1`, required. It makes the element programmatically focusable without adding a tab stop |
| Focus ring | The state line is not interactive, so it takes **no visible focus ring**: scope the ring rules to interactive elements, or set `#filter-status:focus { outline: none }` with `:focus-visible` unset. This is the one permitted exception to the never-remove-an-outline rule in `DESIGN.md`, and it is permitted because the element is not operable |
| Scroll | `focus({ preventScroll: true })`. The chips must stay on screen; the user has just used them |
| When focus moves | Only when the navigation was caused by activating a chip, the clear-the-filter link, or the cross-listing link. The handler that initiates the navigation sets a flag on the history entry (`history.pushState({ fromFilter: true }, ...)`) and the code that runs after render moves focus only if `history.state?.fromFilter` is true |
| First load and deep link | **Focus is not moved.** The browser and the screen reader are already announcing a new document, and taking focus on load competes with that, skips the page title and the `h1`, and breaks the reading start position. The state line is the third thing in reading order on the listing, so a deep-linked user reaches it immediately anyway |
| Back and forward | **Focus is not moved.** `popstate` restorations never carry the `fromFilter` flag, because it was written for the forward navigation only. Moving focus here would destroy the restored scroll position and the user's place |
| With JavaScript off | No focus moves, because a chip click is a full page load. The announcement fallback is the document `<title>`, which is the first thing a screen reader reads on a new document. The title carries the count: see below |
| Verification | One manual pass with VoiceOver or NVDA: select a chip, confirm the new count sentence is read without the user pressing anything. This is the check, and it is not optional. No automated tool can perform it |

**Document title carries the count on every filtered route**, which is what makes the JS-off path work and is worth having regardless:

| State | `<title>` |
|---|---|
| Unfiltered | `Experience \| Shahrouz Mohaghegh` |
| One capability | `Experience, 1 of 3 case studies, Executive and Stakeholder Influence \| Shahrouz Mohaghegh` |
| Several | `Experience, 2 of 3 case studies, Engineering Leadership or AI-Native Engineering \| Shahrouz Mohaghegh` |
| Empty | `Experience, no case studies match Hands-On \| Shahrouz Mohaghegh` |

### Exact state-line strings

The bold span is `{components.state-line}` `emphasis`; the rest is the body of the sentence. Capability names are always the **full** form from the PRD taxonomy, never the chip short label. Counts are literal integers, never words.

| State | State line |
|---|---|
| Unfiltered | **Showing all 3 case studies.** No capability filter applied. |
| One capability, results | **Showing 1 of 3 case studies**, filtered by Executive and Stakeholder Influence. |
| Two capabilities, results | **Showing 2 of 3 case studies**, filtered by Engineering Leadership or AI-Native Engineering. |
| Three or more | **Showing 3 of 3 case studies**, filtered by Engineering Leadership, AI-Native Engineering or Executive and Stakeholder Influence. |
| Empty | **Showing 0 of 3 case studies**, filtered by Hands-On. |

Construction rules: names are joined in the canonical chip order; two names join with `or`; three or more join with commas and a final `or`, with no comma before it. `Showing 1 of 1 case study` takes the singular noun. On `/projects` substitute `projects` and `project` for `case studies` and `case study`. The cross-listing sentence is a separate element and is never merged into the state line.

## Diagram System

Product-specific section. Diagrams are evidence, a peer of case studies, not illustration of them. Per the governing strategy, photography establishes the person and diagrams establish how he thinks.

**Shipping in V1, two primitives:**

1. **Sequence.** A labelled ordered progression rendered from a dataset. Carries the AI-native engineering lifecycle (Intent, Context, Specification, Agents, Verification, Human Review, Production) and the cloud evolution (On-premise, Hybrid, Cloud-native). Horizontal row on desktop, vertical rail at 375px, identical markup, no horizontal scroller, text alternative on the page.
2. **Decision model, two-state table only.** The governed retrieval layer. Relevance, authority and expiry are three **orthogonal** gates on one candidate, not three stages in a line. Vector search decides what is relevant, authority decides which source wins when relevant sources conflict, expiry decides when a source must stop winning. A candidate admitted by two gates is still not the answer, and that is the argument the diagram exists to make. State one sits inside an exception window; state two is four days after the expiry date, with the index unchanged and only the calendar moved, and the answer inverts. Both states carry a rendered text alternative.

**Deferred to post-V1, design already banked in `mockups/diagram-system.html`:**

- The SVG axes emblem above the decision table. Judged the decorative half; the table is where the argument lives.
- The cycle variant of the sequence (Incident, Postmortem, Telemetry, Pre-mortem, Deployment confidence, closing back on the first).
- The responsibility split primitive (what a human owns against what an agent does).

Excluded permanently: cloud icons, service logos, infrastructure topology, generic AI imagery, Azure architecture diagrams, any diagram library.

**Funding and timeline for the decision table are unresolved and belong to Winston and then to John.** See Open items.

## Imagery Rules

Product-specific section. Governed by `photography-brief.md`.

- The portrait appears exactly twice: once on Home, once on Contact. Plus one small 168px use of the desk frame inside the hands-on passage of the AI-native case study, which is the only place a screen appears in a photograph anywhere on the site.
- **The hero is never full-bleed.** It is a cropped editorial object at roughly 36 percent of the band on desktop, and a contained vertical plate below the statement on mobile that never touches the screen edge.
- Desktop and mobile hero are the **same file** at different container ratios and `object-position` values. Never two pre-cropped assets.
- Current images are AI-enhanced stand-ins at 1311 x 1200, which is about 1.37x headroom on the desktop plate and 1.50x on the mobile plate. **Never upscale beyond natural size anywhere.** Real photography is a post-launch improvement, not a launch prerequisite.
- The black-background studio frame is only ever used on a deep ground, where it meets the band edge to edge rather than floating as a dark rectangle on ivory.
- No other photography. No stock. No portraits in listings, cards or case-study bodies.

## Typeface Assignment

Typography is specified in `DESIGN.md`. It is restated here only as a behavioural rule, because it governs how a builder treats a component nobody mocked.

**Serif for voice, sans for instrument.** Serif carries exactly four roles: the hero headline, the page title, evidence figures, and pull quotes or outcome statements. Everything else is sans, including section headings, card titles, body copy, navigation, capability chips, the decision table, specification rows and all metadata.

The test for an unspecified element: is this something he is **saying**, or something he is **showing**? Saying is serif, and it is almost never saying.

A token moved between families must also be resized. The system sans has a larger x-height than the serif stack, so swapping the family at the same pixel value visibly breaks the hierarchy. `DESIGN.md` Typography carries the adjustments.

## State Patterns

| State | Surface | Treatment |
|---|---|---|
| Default, unfiltered | `/experience`, `/projects` | All items listed. State line reads "Showing all 3 case studies. No capability filter applied." plus the count on the other route. Renders server-side with JavaScript off |
| One capability selected | Either listing | Chip carries fill, check glyph and a visually hidden ", selected". State line names the count and the full capability name. Cross-listing line names the other route's count and offers clearing |
| Multiple selected | Either listing | OR logic, the union not the intersection. State line names every selected capability |
| Empty | Either listing | Explanatory prose first, then the cross-listing link, then clear-the-filter. Never blank, never a spinner |
| Deep link to a filtered URL | Either listing | Reproduces the identical result set, chips restored, state line correct, in a fresh browser session |
| Back and forward | Either listing | Browser history moves through filter states in order |
| JavaScript disabled | Every surface | All content **visible**, not merely present in the DOM. All detail routes reachable, motion absent. Filtering still works, as a full page load per link. Guaranteed by the reveal mechanism in Interaction Primitives: the hidden state is applied by script, so with no script nothing is ever hidden |
| CSS disabled | Sequence, decision table | Ordered-list and table markup keep the meaning. Text alternatives already read as prose |
| Scroll reveal | Home bands, sequence stages | Opacity 0 and `translateY(10px)` to rest over 320ms ease-out at 25 percent visibility, stages staggered 60ms. The starting state is applied by the `js-reveal` root class only, never by static CSS. See Interaction Primitives |
| Reduced motion | Every surface | `prefers-reduced-motion: reduce` **skips the IntersectionObserver entirely and never adds the `js-reveal` root class**, so content is at rest from first paint. Dropping only the CSS transition is wrong: it leaves elements at `opacity: 0` until the observer fires, which is content popping in on scroll, the exact effect the setting exists to prevent |
| Hover | Links, chips, cards | Underline or tonal change only. No lift, no shadow, no scale |
| Focus | Every interactive element | Visible indicator required. Treatment is fully specified in `DESIGN.md.Focus indicator`: 2px outline at 2px offset, ring colour chosen by the ground the element **sits on**, minimum 3:1 against that ground. The one non-interactive focus target is `#filter-status`, which takes no ring; see Capability Filter Contract |
| Broken repository link | `/projects/[slug]` | Launch-blocking check rather than a runtime state. A dead or abandoned-looking repository inverts UJ-3 and damages the positioning |
| Image fails to load | Home, Contact | Plate ground `{components.hero-plate}` remains with its `alt` text. Nothing above the fold depends on a late-loading asset |
| Error and offline | Global | No states. Static site, no fetches, no forms, so there is no loading state, no toast and no error surface in V1 |

## Interaction Primitives

- **Click or tap to act.** Every interactive element is a real link or a real button with a real target.
- **Chips toggle.** Activating a selected chip deselects it and returns to the prior broader set.
- **Filtering is navigation.** A filtered view is a URL. It is pasteable into a panel chat and it survives a fresh session.
- **In-page anchors** for case-study sections, from the section rail.
- **Motion ceiling, hard.** IntersectionObserver plus CSS `opacity` and `transform` transitions only, honouring `prefers-reduced-motion`, with all content in the DOM and **visible** without JavaScript.
- **The reveal's hidden state comes from script, never from the stylesheet.** This is a build instruction, not a principle, and it is the single most likely way this site ships broken.

  | Rule | Specification |
  |---|---|
  | Where the hidden state lives | A single root class. Script sets `document.documentElement.classList.add('js-reveal')` as its first action on load |
  | CSS scoping | **Every** rule that sets `opacity: 0` or a `translateY` offset is scoped under `.js-reveal`, for example `.js-reveal .reveal { opacity: 0; transform: translateY(10px); transition: opacity 320ms ease-out, transform 320ms ease-out; }` and `.js-reveal .reveal.in { opacity: 1; transform: none; }` |
  | Forbidden | An unscoped `.reveal { opacity: 0 }` anywhere in any stylesheet. With JavaScript off, `.in` is never added and every revealed element stays invisible forever. The content is in the DOM, the page is blank, and no audit catches it because `opacity: 0` does not remove an element from the accessibility tree |
  | JavaScript off | The root class is never added, no rule matches, nothing is ever hidden, the page renders at rest. This is the default rendering, which is what makes it safe |
  | Reduced motion | `if (matchMedia('(prefers-reduced-motion: reduce)').matches)` the root class is **not** added and **no observer is created**. Not a transition override, not a `transition: none` rule: the observer is never constructed |
  | Verification | Load Home with JavaScript disabled in the browser and confirm both evidence figures are visible. Then load it with reduced motion on and confirm nothing moves and nothing fades in |

- **Banned everywhere:** scroll-jacking, parallax, pinned sections, scroll-driven timelines, animation libraries, carousels, lightboxes, modals, tooltips as the only carrier of information, infinite scroll, hover-only affordances, horizontal scrollers at any width, autoplaying anything, a cookie banner (there is nothing to consent to beyond privacy-preserving analytics).

## Accessibility Floor

Behavioural. Visual contrast is specified and already checked in `DESIGN.md.Colors`.

- **WCAG 2.1 AA** across the site, verified by automated audit in CI plus one manual keyboard pass.
- Semantic HTML throughout. One `h1` per route, heading order never skipped. Size comes from a `DESIGN.md` typography token, not from choosing a larger tag.
- Every interactive element reachable and operable by keyboard alone, in reading order, with a visible focus indicator.
- **No information by colour alone.** The selected chip carries fill, a check glyph and the word Selected. Sequence stages are numbered. Decision-table verdicts are glyph plus text. The winning row is marked tonally and in words. The availability dot is decorative only.
- **Filter result counts are announced on change** by moving focus to the state line. There is no live region on this site. Full mechanism, and why the live region was rejected, in Capability Filter Contract.
- `aria-current="page"` on the current nav item. `aria-current="true"` on the selected capability chip and on the current section-rail anchor. **`aria-pressed` is used nowhere**: the chips are links, and browsers do not map `aria-pressed` on a link.

- Decorative glyphs and drawn connectors are `aria-hidden`. Every relationship a drawing carries is also carried in a sentence, so nothing is lost when the drawing is invisible to assistive technology.
- The sequence and the decision table each render a **visible** text alternative, written once with the dataset rather than per breakpoint.
- The decision table must expose real table semantics in both layouts. See Production Carry-forward.
- Informative `alt` on both portraits. Images carry explicit dimensions.
- **No horizontal scroll at any width.** Fully usable at 375px, 768px and 1440px.
- Email obfuscation must not impede a screen reader.

### Landmarks

Every route renders the same four landmarks, in this order, and nothing sits outside them:

| Landmark | Element | Rule |
|---|---|---|
| Banner | `<header>` | Wraps the primary nav. One per route |
| Primary navigation | `<nav aria-label="Primary">` inside the header | Already correct in the mockups. Recorded here so it survives the rebuild |
| Main | `<main>` | **One per route, wrapping all route content**, starting with the route's single `h1`. No mockup renders this today and neither spine previously required it, so it will be omitted unless it is written down. Without it there is no bypass mechanism for the repeated header, which is SC 2.4.1 Bypass Blocks, Level A and inside the AA claim |
| Contentinfo | `<footer>` | The three-column site footer. Outside `<main>` |

The case-study and project section rail is a second navigation landmark, `<nav aria-label="Sections of this case study">`, and it sits **inside** `<main>` because it navigates within the document. No skip link is specified: the header holds one wordmark and three links, so `<main>` alone satisfies the bypass requirement and a skip link would add a control with no work to do.

### Link affordance outside navigation

**Every link outside a `<nav>` carries a non-colour affordance, and that affordance is an underline.** Named, so there is one answer rather than a per-component judgement.

| Link class | Affordance | Contrast of the affordance against its ground |
|---|---|---|
| Body and prose links, cross-listing link, call to action `{components.cta-link}` | 1.5px solid `{colors.accent}` underline | 8.6:1 on paper |
| Footer links `{components.footer}` | 1px solid `{colors.muted}` underline | 7.82:1 on panel. The previous `{colors.rule}` underline measured **1.06:1** and was not perceivable, which left footer links distinguished from static text by nothing at all |
| Contact route links `{components.contact-hero}` | 1.5px solid `{colors.deep-accent}` underline | 7.87:1 on deep. Previously `{colors.deep-rule}` at **1.61:1**. These two links are the entire purpose of the route |
| Evidence card title `{components.evidence-card}` | Underline on hover and focus only, permitted because the card also carries a visible "Read the case study" link to the same target, so the destination is reachable and labelled without it |
| Sequence stage label | **Not a link.** The stage label had no affordance at all and no sibling link to mitigate it. If a stage must be navigable, add a labelled link beneath it rather than making the label itself one |
| Repository call to action `{components.repo-cta}` | The panel is an accent surface and the title carries a 2px `{colors.on-accent}` underline, 8.2:1 on accent |

The underline is the affordance in every case. A colour change alone is never sufficient, and a hover-only underline is never sufficient outside the one exempted case above.

## Not Found

One shared treatment for both dynamic routes. Deliberately not bespoke: it reuses existing components and should be a very small implementation item.

**Why it earns a specification.** Flow 4 ends with a visitor pasting a filtered or detail URL into a panel chat for colleagues to open. A stale slug, a truncated paste or a typo then lands a hiring panel on whatever the framework produces by default. A polished site returning a stock framework error page weakens the impression disproportionately, and it does so in front of exactly the audience the site exists to persuade.

| Property | Specification |
|---|---|
| Scope | `/experience/[slug]` and `/projects/[slug]`. One component, two messages |
| HTTP status | **Must be a real 404.** In Next.js, call `notFound()` from the route segment so the status code is correct, not a 200 rendering an error message |
| Heading | `{typography.page-title}`. "This case study is not available." on `/experience/[slug]`, "This project is not available." on `/projects/[slug]` |
| Body | One sentence in `{typography.body-lead}`: the page may have moved or the link may be incomplete |
| Routes out | Three links in `{components.cross-listing-link}` style: the matching listing first (Experience or Projects), then the other listing, then Home |
| Layout | Standard route shell: `header`, `nav`, `main`, `footer`. No hero, no portrait, no evidence sections |
| Ground | `{colors.paper}`. Never a dark band, and never the accent |
| Tone | Plain and unapologetic. No humour, no illustration, no "oops" |

**Out of scope for V1:** search, suggested-content matching, and any attempt to guess the intended slug.

## Print

A print contract, not a third responsive mode. The site deliberately publishes no CV, so a recruiter or a panel member printing a case study to read or annotate is a realistic path rather than an edge case.

Scope is a single `@media print` block. Everything below is the whole requirement.

| Concern | Rule |
|---|---|
| Navigation and controls | Hide `nav`, the capability filter, chips, the state line, the cross-listing link and the sticky rail. They are all navigation, and navigation does not print |
| Backgrounds | Drop every tonal and dark ground to white with `{colors.ink}` text. The dark evidence bands and the deep contact hero must not print as solid blocks: it wastes toner and many printers render them near-black with unreadable text |
| Accent | Keep `{colors.accent}` as text colour only. Never as a filled panel. The repository call-to-action prints as a link, not as a block |
| Link URLs | Expand external links to show the href after the link text, so a printed page still carries the repository URL and the LinkedIn address. Do **not** expand internal navigation links, which would add noise |
| Collapsed and revealed content | Everything hidden by the scroll reveal must be visible. The `js-reveal` mechanism already leaves content visible without script, and print must inherit that rather than fight it |
| Clipping | No `overflow: hidden` on any content container. The decision table and the sequence component must print in full and are the two most likely to clip |
| Page breaks | `break-inside: avoid` on cards, evidence figures with their captions, decision-table rows and sequence stages. `break-after: avoid` on headings so no heading orphans at a page foot |
| Images | The hero portrait prints. Decorative tonal blocks do not |
| Page size | Default margins. No custom paper size, no forced landscape |

**Acceptance:** a case study and a project detail page each print to A4 as readable black-on-white, with the repository URL visible, no clipped table, and no heading stranded at the foot of a page.

**Out of scope for V1:** a print stylesheet for the listings, page numbering, headers or footers, and any print-specific content.

## Responsive and Platform

Mobile is **designed independently, not the desktop layout stacked**. Same confidence, less information competing at once. Compression is of gaps, never of the type ramp.

| Width | Behaviour |
|---|---|
| 1440px and above | Hero is a two-column grid, text plus a `{spacing.hero-plate-desktop}` plate at about 36 percent of the band. Card grids are three columns. Case study runs a sticky section rail beside a `{spacing.measure-body}` body. Sequence runs as a horizontal row. Section padding `{spacing.section-desktop}` |
| 768px | Between the two compositions. Card grids and the case-study rail are the two things that must resolve here; no artifact renders 768px, so this width is specified by rule rather than by mock (see Open items) |
| 375px | Hero is a single block: his name as the `h1`, the positioning statement, availability, then `{components.figure-pair}`. **The fold falls here, at 550px.** Below it: a contained `{spacing.hero-plate-mobile}` plate, then an Explore affordance, then the two evidence bands. The kicker does not render at 375px. Card grids are one column. The section rail becomes a static `{colors.panel}` box above the body. Sequence rotates into a vertical rail with the connector on the left edge. Chips wrap to a second line. Facts strip and key-value rows stack. Section padding `{spacing.section-mobile}` |

**The fold at 375px is defined as 375 x 550 CSS pixels.** Binding, and it is the viewport the single Playwright test sets. It approximates what iOS Safari actually shows on a 375x667 device, about 553px, which is the smallest phone in realistic use. Anything that clears 550px clears every larger phone, so the number is deliberately strict rather than generous.

Fold discipline at 375px, in render order above that fold: his name as the `h1`, the positioning statement, the availability line, and `{components.figure-pair}` carrying the two quantified markers FR-5 requires as figures. Measured from the top of the viewport, header included, this stack measured at about 525px on the built site (2026-10-11), leaving roughly 25px of headroom, with the name on two lines and the figure-pair labels wrapping. The header's block padding is 16px below 768px. The positioning line "Engineering leadership in regulated industries, measured by what ships and stays shipped." renders in the footer, not in the hero.

**The portrait plate moves below the fold at 375px, and the kicker does not render there at all.** The plate is not a choice: `{spacing.hero-plate-mobile}` is 330px tall and cannot fit above the fold together with the name, the 168px positioning statement and the figure pair inside 550px. The kicker is a choice, and it is cut rather than relocated: it is three words of category framing that belong directly under the name, so placing it below the fold would orphan it from the only element it modifies. Dana's thirty seconds are better spent on the two numbers. Both the plate and the kicker stay in the hero at 1440px, where the fold is 900px and there is room. **This is a deliberate content-parity loss at 375px**, accepted because the kicker duplicates categorisation the positioning statement already carries.

**This supersedes a claim that was already false.** The previous version of this line put identity, the positioning statement, availability and the portrait all above the fold at 375px. Measured, that stack came to about 876px against 553px of visible viewport, an overrun of roughly 323px before any figure was added. FR-5's amendment did not create that problem, it exposed it.

Below the fold, in order: the portrait plate, the Explore affordance, then the two evidence bands. The Quality band is captioned "Fault Feedback Ratio: every reopened bug and every new issue linked back to it, per bug fixed, on the 26-person Vietnam team, part of the 38-person function." The Secure Score band is captioned "Microsoft Defender for Cloud Secure Score across the full production Azure subscription, reported to the Digital Governance Board." The estate size is not published (FR-29, amended 2026-10-07).

**Neither evidence band repeats the figure pair.** The pair is Dana's two numbers without scrolling, people then speed, each scoped in the line beneath it. The Quality band carries the Fault Feedback Ratio and the Security posture band the Secure Score, each with a caption that carries FR-34's scope in full prose, for Marcus once he scrolls.

**One positioning statement, at both widths, 40 to 45 words.** `mockups/screen-home.html` previously carried two different support paragraphs, 53 words on desktop and 42 at 375px. That cannot ship: FR-4 is one statement. Both frames now carry the 42-word version, because at 53 words the 375px stack measures about 573px and overruns the fold. The composition is verified at 375px and still needs a 320px check, since a headline wrapping to a fourth line costs 36px and the headroom is 25px.

Platform: browser only. No native app, no PWA behaviour, no install prompt, no push. Static generation everywhere except `/experience` and `/projects`, which render dynamically because they accept the `capability` search parameter (NFR-6 declared exemption, AD-4). There is no dynamic data in V1.

## Production Carry-forward

Binding notes for whoever builds the decision table, from the agent that prototyped it. Read these before starting.

1. **The `display: block` reflow at 375px strips implicit table roles, and here is the exact fix.** At 375px the prototype changes `display` on the table and every descendant, which removes their implicit roles from the accessibility tree in Chrome and Safari. The HTML is a real table and the accessibility tree is a stack of paragraphs. "Restore table roles explicitly" has been read three ways; only one works.

   **Roles are restored per element, on every level, unconditionally in the markup:**

   | Element | Role to author | Also keep |
   |---|---|---|
   | `<table>` | `role="table"` | |
   | `<thead>`, `<tbody>`, `<tfoot>` | `role="rowgroup"` on each | |
   | `<tr>` | `role="row"` | |
   | `<th>` in the header row | `role="columnheader"` | `scope="col"` |
   | `<th>` at the start of a body row | `role="rowheader"` | `scope="row"` |
   | `<td>` | `role="cell"` | |

   **Three rules that make the difference between this working and not:**

   - **Every level, not just the table.** A `role="table"` on the `<table>` alone does nothing, because the roles are stripped per element by that element's own `display` change, not inherited from an ancestor. This is the reading a developer under time pressure will take, and it produces a table that passes visual review, passes axe, and still reads as flat paragraphs to VoiceOver.
   - **Unconditional in the markup, never toggled by breakpoint.** CSS cannot add a role, and a media query cannot reach the DOM, so a developer trying to apply roles only at 375px will reach for `matchMedia` and JavaScript. That is more work and it fails with JavaScript off. The roles are harmless at desktop because they are identical to the implicit ones.
   - **`scope` stays.** `role` restores the tree, `scope` is what associates a header with its cells. Do not swap one for the other.

   **Verification, and it is the acceptance criterion:** VoiceOver on iOS at 375px must announce the table as a table with a row and column count, and must read the row header with each cell as you move across a row. Budget about 1.5h for the fix and the screen-reader pass together. It is not optional.

   **The cheaper alternative, if the 1.5h cannot be found.** Do not use `display: block` at all. Keep the table a table at 375px and reduce it to two columns, candidate source and outcome, by hiding the three gate columns with `display: none` on those `<th>`/`<td>` only. Hiding cells does not disturb the roles of the elements that remain. The three gate verdicts are already carried in the rendered text alternative below the table, so the argument survives intact. This costs no screen-reader remediation, no role authoring, and no horizontal scroller, which is banned site-wide. It is the recommended option if the decision table ships against the budget recorded in Open items 7.
2. The `.m` ancestor-class breakpoint scoping in the prototype is a demo device. Production needs a real media query.
3. The prototype carries **two different sets of copy per breakpoint**. One component cannot ship both. A decision is required on which copy is canonical.
4. The `<use href="#sprite">` symbols depend on a sprite being present in the DOM exactly once. That is a layout-level decision, not a component-level one.
5. Fixed 24/19/19/19/19 percentage column widths are brittle against longer future content.
6. The visible state heading is a paragraph with the real caption hidden. A reviewer will catch this. Fix it before review, not after.
7. Winning-row shading uses two different mechanisms across breakpoints and needs consolidating into one.
8. The worked values 0.91, 0.87 and 0.93 are **illustrative and internally consistent, not measured**. The production page must say so.

## Inspiration and Anti-patterns

- **Lifted from the Broadsheet direction:** editorial authority, the serif lede, the pull-figure. Taken as posture, never as furniture. No mastheads, no bylines, no column rules.
- **Lifted from Apple-like restraint:** one idea at a time, generous air, progressive disclosure, photography and typography doing all the work. Taken as pacing only. The resource assumptions underneath it were explicitly rejected: Apple uses photography because it has physical products to photograph, so the equivalent asset here is the engineering material, not a commissioned shoot.
- **Lifted from museum wall labels:** a figure, a short caption, and silence around both.
- **Rejected, online resume.** The site is not a chronology and there is no CV download. The absence is explained on Contact rather than left as a gap.
- **Rejected, developer portfolio.** No terminal aesthetics, no animated hero text, no particle or gradient backgrounds, no skill-percentage bars, no technology logo grids, no dark-mode-as-personality.
- **Rejected, SaaS or product documentation site.** No feature grid, no pricing-table rhythm, no sidebar docs navigation, no component-library defaults.
- **Rejected, AI-consultant website.** No abstract-network imagery, no thought-leadership visual language, no AI-first homepage. AI evidence sits inside case studies and carries its qualifiers.
- **Rejected, three bespoke visualisations.** They were one component with three datasets. Building three would have cost 6 to 9 hours against a 30-hour budget and misrepresented the one idea that is genuinely not a sequence.
- **Rejected, cutting CS-3 to fund the diagram.** The site must represent him first as a senior engineering leader rather than over-indexing on AI architecture. All three case studies stay.

## Key Flows

### Flow 1, Dana screens a candidate on a phone between meetings (UJ-1)

1. Dana opens the link from a LinkedIn message, on a phone, on mobile data.
2. Home renders above the fold: his name, a positioning statement naming the 38-person function through six people-managers and the standing Digital Governance Board seat, "Open to conversations about the next role.", and the two hard numbers UJ-1 requires her to see: about 35% of engineers grown into senior or leadership roles across the 38-person function, and 30 to 40% faster cycle time across AI-assisted pilot projects. Then the portrait plate.
3. Nothing above the fold depends on a late-loading asset. LCP is under 2.0 seconds on simulated mobile 4G.
4. **Climax:** Dana does not scroll. She can already describe his level and scale to a client without opening a CV, so she copies the URL into a note and adds him to the shortlist.
5. Failure: if the portrait has not loaded, the plate ground and the `alt` text hold the composition and the judgement is still available from type alone.

### Flow 2, Marcus assesses judgement before agreeing to a call (UJ-2)

1. Marcus, a CTO with a delivery problem and five minutes, arrives from a recruiter's email on a laptop.
2. Home gives him the shape. He follows "Explore selected work" to `/experience`.
3. Three cards. He opens the delivery and quality one because that is his actual pain.
4. The facts strip tells him the team was 26 people hired and run directly, within a 38-person function, in regulated healthcare. The section rail tells him the page has five parts.
5. He skims Decisions. Every decision carries its trade-off set apart.
6. **Climax:** the outcome band states the Fault Feedback Ratio taken from over 1 per fix to under 1 in 5, attributed in the same sentence to the 26-person team he hired and ran, with the source note underneath stating exactly what the ratio counted. Marcus can now name two measurable outcomes and has a question to ask, so he accepts the call.
7. Failure: he skipped the prose. The key and value list repeats every number, so nothing is lost.

### Flow 3, Priya checks whether the technical claims are real (UJ-3)

1. Priya, a Principal Engineer on an interview panel, sceptical of AI claims by default, goes straight to `/projects`.
2. She ignores the narrative and opens the repository link on the Career Application System.
3. She finds architecture documentation, a clean commit history and TypeScript source.
4. **Climax:** she returns to the AI-native case study and reads the decision model. Relevance 0.91 loses to authority; four days later the same index inverts the answer on expiry alone. She closes the tab having concluded he actually builds things and actually thinks about them.
5. Failure: a broken or abandoned-looking repository inverts this journey and actively damages the positioning. Link integrity is a launch-blocking check, not a runtime state.

### Flow 4, Tom checks one capability before a panel meeting (UJ-4)

1. Tom, an Engineering Director, has been asked to assess one thing: whether the candidate has operated at executive level across functions or only reported into people who do.
2. He opens `/experience` and selects Executive Influence.
3. The chip fills, carries a check glyph and announces itself as selected. Focus moves to the state line, which reads: "Showing 1 of 3 case studies, filtered by Executive and Stakeholder Influence." The cross-listing line states what `/projects` also holds.
4. He reads the Digital Governance Board case study: a standing seat reporting to the CEO, with the CFO, CDIO, Head of Operations and Head of Security as peers, and Cloud Secure Score from 20 percent to 76 percent.
5. **Climax:** he copies the filtered URL into the panel chat. His colleagues open it in fresh sessions and land on exactly the view he was looking at, chips restored, count correct. Capability-specific evidence found in under a minute, and shared without explanation.
6. Empty path: had he selected Hands-On, `/experience` would return zero. The empty state explains that hands-on evidence is carried by the systems themselves and leads with "2 Projects also match Hands-On", carrying his selection across on the shared parameter.

### Flow 5, a visitor who wanted a CV (conversion)

1. A recruiter reaches `/contact` looking for a download.
2. The deep hero offers exactly two routes: email first, LinkedIn second, each with a sentence saying which is better for what.
3. Below, the page states that there is no CV and why: every CV he sends is written for one job description, and a generic published one would undercut that and be stale within a month.
4. **Climax:** instead of leaving with nothing, the visitor emails him, which is the outcome the absence was designed to produce. He answers within a working day with a version written for the role.

## Open items

Gaps and contradictions found across sources. Named, not filled.

1. **Resolved 2026-10-07: FR-5 versus the rendered fold.** Routed to John via `bmad-correct-course` as recorded, and FR-5 is amended. The decisive finding was that **neither side of the logged conflict matched UJ-1**, the journey FR-5 exists to realize: UJ-1 asks for the 38-person span, the governance seat and **two hard numbers** above the fold, so the original FR-5 overshot it by two markers and this composition undershot it by the two that carry the most weight. Dana explicitly does not scroll, so under the former composition the primary visitor left without seeing a single number. Amended FR-5 requires four markers above the fold at 375px: the 38-person span and the governance seat, which may stay in the positioning prose, plus the bug reopen rate and the cloud Secure Score, which must render as figures. The Azure estate figure moves below the fold as the Secure Score caption. A second correction: this item and the former fold-discipline line both undercounted the composition's compliance, because the positioning paragraph already names the regulated banking, payments and healthcare domains, which is FR-5's sixth marker; three of six were above the fold, not two. The change is funded by retiring the Scale evidence band, which restated the 38-person figure already in the paragraph above it, so nothing is added to the fold on net. The remaining visual decision is Open item 21.
2. **Open, goes to John: About as a route. Writing is resolved and removed.** Every screen render showed both, and PRD §9 defines neither. **Writing is a straightforward error**: Engineering Notes was explicitly cut from V1, so a nav item pointing at it is wrong and the mocks are stale on this point. **About is a genuine question for Shahrouz**, not a defect. Contact is deliberately thin (email and LinkedIn, no CV), so there is currently nowhere the second warmer portrait from `photography-brief.md` Shot 2 lives, and nowhere a fuller narrative sits. Adding the route is a PRD change and goes to John. Until then the nav carries three items.
3. **Resolved: there is no mobile disclosure menu.** With three short nav items the list fits inline at 375px, so the nav renders identically at every breakpoint. This removes a component, a panel, a close affordance, a focus-trap decision and a keyboard specification from the build, and it is more accessible by construction than any disclosure pattern would be. If About is later added as a fourth item, re-test at 320px before assuming this still holds.
4. **Resolved: focus indicator specified, and its selection rule corrected.** `DESIGN.md.Focus indicator` defines `{colors.focus-ring}` and `{colors.focus-ring-on-deep}`, a 2px outline at 2px offset, and the rule that the ring colour is chosen by **the ground the element sits on**, not by the element's own fill, at a 3:1 minimum measured against that ground. The earlier light-or-deep wording produced a 1.98:1 ring on the repository call to action, the highest-stakes control on the site. The State Patterns Focus row now points at that section instead of claiming the treatment is unspecified. Still needs Shahrouz's sign-off rather than being treated as settled.
5. **Open, low risk: 768px is unrendered.** NFR-1 names it as a supported width. No artifact shows it. Specified here by rule only.
6. **Open, accepted risk: `/projects` is spine-only.** `/projects/[slug]` was mocked after this was written, as `mockups/screen-project.html`, so only the listing now lacks a visual reference. The listing inherits the `/experience` filter, chip, state-line, card and empty-state patterns exactly; the detail route inherits the case-study patterns with an eight-part structure instead of five. The repository-link treatment now has a reference in `mockups/screen-project.html`, where it is the primary call to action carrying the accent in three places.
7. **Open, goes to Winston then John: Decision table is not funded.** About 6 to 6.5 hours remain against a budget already at roughly 29 hours of 30, with a further 1 hour overrun risk. Dropping PR-3 saves 2 hours and still leaves about 3.5 hours over. Cutting CS-3 was offered and declined. The two live options are shipping V1 without the diagram and making it the first post-launch increment, or accepting a third week. Deferred to Winston at architecture and then to John as a scope change. Nothing is lost by deferring because the design is banked in `mockups/diagram-system.html`.
8. **Open, goes to Winston: Decision-table copy per breakpoint is undecided.** The prototype carries two different copy sets. One component cannot ship both. See Production Carry-forward item 3.
9. **Open, gated on Shahrouz: PR-3 needs an IP-clearance and anonymising pass only Shahrouz can perform.** Not a UX gap, but it gates a surface this spine describes.
10. **Open, improvement not blocker: the Contact portrait is an interim.** `photography-brief.md` Shot 2 specifies a warmer no-jacket frame for Contact. That frame does not exist yet, so the black studio portrait stands in. The two documents agree: the brief describes what to shoot, the spine describes what ships today. Swap on delivery.

11. **Resolved: the filter result count announcement mechanism.** Focus moves to the state line, `tabindex="-1"`, only on a navigation the user initiated from a chip or a filter link, never on first load and never on back or forward. The live region is removed from the contract and from the mockups' intent, with the rejection reasoned in Capability Filter Contract. The document title carries the count as the JavaScript-off fallback. **This needs one manual screen-reader pass to verify and no automated tool can do it**, so it is a named line item in the build, not an assumption.
12. **Resolved: chips are links, and `aria-pressed` is removed everywhere.** Selected state is carried by `aria-current="true"` plus the visually hidden `, selected`, which is explicitly retained as belt and braces. The link-versus-button question is decided in favour of links, with the four requirements that decide it stated.
13. **Resolved: the multi-value URL encoding.** One `capability` parameter, comma separated, four fixed slugs, canonical order matching the chip order, parameter omitted when empty, liberal on read and canonical on write. Previously written nowhere, and a wrong guess was a rebuild of both listings.
14. **Resolved: content survives JavaScript being off.** The reveal's hidden state is applied by a `js-reveal` root class added by script and is forbidden from static CSS, so the default rendering is visible. `prefers-reduced-motion: reduce` skips the IntersectionObserver entirely rather than dropping the transition.
15. **Resolved: the decision table reflow fix is written as markup.** Roles restored on every level, unconditionally, with `scope` retained, plus the acceptance criterion and a cheaper two-column alternative that avoids `display: block` altogether. See Production Carry-forward item 1. **The 1.5h screen-reader remediation is still unfunded** and sits inside the same budget problem as item 7.
16. **Resolved: landmark structure and link affordance specified.** `header`, `nav aria-label="Primary"`, `main`, `footer` on every route, with the section rail as a second nav inside `main` and no skip link by decision. Every link outside a nav carries an underline, with the token and measured ratio per link class. **Corrected 2026-10-07: `<main>` is present in every screen mockup**, in both the desktop and the 375px frame. The earlier claim that it appeared in no mockup was wrong. Only `mockups/index.html`, which is the sheet index, and `mockups/diagram-system.html`, which is a component sheet, have no `<main>`, and neither renders a route.
17. **Resolved: the trade-off pair uses a 2px ink rule, and the mockup now matches.** `mockups/screen-project.html` drew the costs side in accent, which would have been a fifth oxide mark on `/projects/[slug]` and eroded the repository call-to-action exemption that makes the accent allow-list meaningful there. The spine specified a 2px ink rule instead and the mockup has been changed to agree, so this is no longer a divergence. The two sides remain distinguished in words, "What it buys" and "What it costs", so the rule was never the only signal.
18. **Resolved: not-found specified.** See Not Found. One shared treatment across both dynamic routes, a real 404 status rather than a 200 rendering an error, two messages, three routes out, no bespoke design.
19. **Resolved: print specified.** See Print. A single `@media print` contract covering navigation, backgrounds, link URLs, revealed content, clipping and page breaks, with an acceptance criterion. Scoped to detail pages; listings are out of scope for V1.
20. **Resolved: the cross-listing link has a visual specification.** `{components.cross-listing-link}` now exists in `DESIGN.md`, covering type, colour, the underline affordance so the signal is not colour alone, the count prefix, and its placement both beneath a filter state line and as the first element of an empty state. It is explicitly never styled as a button, because it is a route change rather than an action.

21. **Resolved 2026-10-07: the above-fold figure pair is specified, and a bigger problem was found underneath it.** `{components.figure-pair}` and `{typography.figure-inline}` now exist in `DESIGN.md`, and Figure demotion carries a third clause exempting the pair, which settles the 40px beside 23px mismatch by removing the pair from the rule rather than rewriting how every band sizes. **The type collision was the small half.** Measuring the stack showed the fold discipline was already unachievable before FR-5 was amended: identity, the positioning statement, availability and the portrait came to about 876px against the 553px a 375x667 phone actually shows, an overrun of roughly 323px with no figure involved, the plate alone being 330px. So: the fold at 375px is now **defined** as 375 x 550, the portrait plate and the kicker both move below it, and the measured above-fold stack is about 525px with 25px of headroom. The scope labels carry FR-34 and Addendum section 3 in one line each, "BUG REOPEN RATE, 26 IN VIETNAM OF 38" and "SECURE SCORE, FULL PRODUCTION ESTATE" (label revised 2026-10-07, estate size removed from the site; same 36-character length, so the one-line fit holds); the first is stronger than the amended FR-5 asked for, because it states both numbers rather than only describing the 26 as part of the 38. **Two items are routed back to John and are not absorbed here:** (1) the support paragraph must sit at FR-4's 40-word floor for this to close, while FR-4's statement still says "roughly sixty words" against a consequence permitting 40 to 80, so the statement needs to match its own consequence or the pair does not fit; (2) AD-12 gives the hero `priority`, which is now wrong at 375px where the plate is below the fold and the LCP element becomes the headline text, so it goes to Winston. See `DESIGN.md` Open items 13.
22. **Resolved 2026-10-07: `mockups/screen-home.html` is refreshed, and one claim about the mockups was wrong.** The sheet now renders the resolved composition in both frames: `{components.figure-pair}` above the fold, the Scale band retired, the mobile fold marker corrected from `375 by 812` to `375 by 550`, and at 375px the plate moved below the fold with the kicker cut. `mockups/screen-project.html` carried the same stale `375 by 812` marker and is corrected too. Two findings from doing it. **First, the `<main>` claim was false:** every screen mockup already renders `<main>` in both frames, and only the sheet index and the component sheet lack it, neither being a route. That error propagated into `epics.md` as UX-DR46 and into Story 2.2's acceptance criteria, so both need correcting; it goes back to John. **Second, the sheet carried two different positioning paragraphs,** 53 words on desktop and 42 at 375px, which FR-4 cannot permit since it is one statement. Both frames now carry the 42-word version, and the desktop one was the one that had to change. `DESIGN.md` Open items 4 cites this mockup as the authority on `20% to 76%` sizing: that figure now has two homes, `{typography.figure-inline}` above the fold and `{typography.figure-small}` in the band below, and the demotion rule's worked example still refers correctly to the band.