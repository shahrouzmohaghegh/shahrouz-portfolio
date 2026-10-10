---
title: ShahrouzPortfolio Design
name: Foundry
description: Warm serif display on ivory. Museum-wall pacing, one deep oxide accent used sparingly across a whole page. The engineering material is the product photography.
status: final
created: 2026-09-23
updated: 2026-10-07
sources:
  - _bmad-output/planning-artifacts/prds/prd-ShahrouzPortfolio-2026-09-23/prd.md
  - _bmad-output/planning-artifacts/briefs/brief-ShahrouzPortfolio-2026-09-23/brief.md
  - _bmad-output/planning-artifacts/briefs/brief-ShahrouzPortfolio-2026-09-23/addendum.md
  - .memlog.md
  - mockups/direction-f1-foundry.html
  - mockups/screen-home.html
  - mockups/screen-experience.html
  - mockups/screen-case-study.html
  - mockups/screen-ai-case-study.html
  - mockups/screen-contact.html
  - mockups/screen-project.html
  - mockups/diagram-system.html
  - photography-brief.md
colors:
  paper: '#FBF7F1'
  paper-alt: '#F4EDE2'
  panel: '#F6EFE4'
  ink: '#181310'
  muted: '#55473B'
  rule: '#E6DCCD'
  chip-border: '#8E7E68'
  tone: '#EFE4D3'
  tone-2: '#DCCDB6'
  accent: '#7E2E16'
  on-accent: '#FCF6F0'
  deep: '#241D18'
  on-deep: '#F6F0E7'
  deep-muted: '#CBBCA8'
  deep-rule: '#4A3E34'
  deep-accent: '#E3A57E'
  studio-ground: '#0C0A08'
  focus-ring: '#7E2E16'
  focus-ring-on-deep: '#E3A57E'
typography:
  serif-stack:
    fontFamily: '"Iowan Old Style", "Palatino Linotype", Palatino, Georgia, "Times New Roman", serif'
  sans-stack:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
  display-hero:
    fontFamily: '{typography.serif-stack.fontFamily}'
    fontSize: 76px
    fontWeight: '600'
    lineHeight: '1.02'
    letterSpacing: -0.025em
  display-hero-mobile:
    fontFamily: '{typography.serif-stack.fontFamily}'
    fontSize: 34px
    fontWeight: '600'
    lineHeight: '1.06'
    letterSpacing: -0.02em
  pull-quote:
    fontFamily: '{typography.serif-stack.fontFamily}'
    fontSize: 31px
    fontWeight: '400'
    lineHeight: '1.34'
    letterSpacing: -0.015em
    note: 'Outcome statements and pull quotes. One of the four serif roles under the C2 calibration.'
  figure:
    fontFamily: '{typography.serif-stack.fontFamily}'
    fontSize: 164px
    fontWeight: '600'
    lineHeight: '0.9'
    letterSpacing: -0.04em
    note: 'font-variant-numeric: tabular-nums'
  figure-small:
    fontFamily: '{typography.serif-stack.fontFamily}'
    fontSize: 104px
    fontWeight: '600'
    lineHeight: '0.9'
    letterSpacing: -0.04em
  figure-mobile:
    fontFamily: '{typography.serif-stack.fontFamily}'
    fontSize: 80px
    fontWeight: '600'
    lineHeight: '0.9'
  figure-small-mobile:
    fontFamily: '{typography.serif-stack.fontFamily}'
    fontSize: 40px
    fontWeight: '600'
    lineHeight: '1.04'
  figure-inline:
    fontFamily: '{typography.serif-stack.fontFamily}'
    fontSize: 23px
    fontWeight: '600'
    lineHeight: '1.2'
    letterSpacing: -0.02em
    note: 'font-variant-numeric: tabular-nums. The figure role for {components.figure-pair} only, and the one figure size exempt from Figure demotion. Identical at 375px and 1440px, so it has no mobile token by decision.'
  page-title:
    fontFamily: '{typography.serif-stack.fontFamily}'
    fontSize: 60px
    fontWeight: '600'
    lineHeight: '1.05'
    letterSpacing: -0.025em
  page-title-mobile:
    fontFamily: '{typography.serif-stack.fontFamily}'
    fontSize: 33px
    fontWeight: '600'
    lineHeight: '1.06'
    letterSpacing: -0.02em
  section-title:
    fontFamily: '{typography.sans-stack.fontFamily}'
    fontSize: 35px
    fontWeight: '600'
    lineHeight: '1.15'
    letterSpacing: -0.03em
    note: 'Sequence-section and filter headings render at 37px after the C2 reduction; treat 35 to 37 as one role.'
  section-title-mobile:
    fontFamily: '{typography.sans-stack.fontFamily}'
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.18'
    letterSpacing: -0.03em
  subsection-title:
    fontFamily: '{typography.sans-stack.fontFamily}'
    fontSize: 31px
    fontWeight: '600'
    lineHeight: '1.18'
    letterSpacing: -0.03em
  card-title:
    fontFamily: '{typography.sans-stack.fontFamily}'
    fontSize: 20.5px
    fontWeight: '600'
    lineHeight: '1.24'
    letterSpacing: -0.02em
  support:
    fontFamily: '{typography.sans-stack.fontFamily}'
    fontSize: 19.5px
    fontWeight: '400'
    lineHeight: '1.56'
  support-mobile:
    fontFamily: '{typography.sans-stack.fontFamily}'
    fontSize: 15px
    fontWeight: '400'
    lineHeight: '1.6'
  dek:
    fontFamily: '{typography.sans-stack.fontFamily}'
    fontSize: 20px
    fontWeight: '400'
    lineHeight: '1.6'
  body-lead:
    fontFamily: '{typography.sans-stack.fontFamily}'
    fontSize: 19.5px
    fontWeight: '400'
    lineHeight: '1.65'
  body:
    fontFamily: '{typography.sans-stack.fontFamily}'
    fontSize: 17px
    fontWeight: '400'
    lineHeight: '1.72'
  body-mobile:
    fontFamily: '{typography.sans-stack.fontFamily}'
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.7'
  ui:
    fontFamily: '{typography.sans-stack.fontFamily}'
    fontSize: 14.5px
    fontWeight: '400'
    lineHeight: '1.5'
  small:
    fontFamily: '{typography.sans-stack.fontFamily}'
    fontSize: 13.5px
    fontWeight: '400'
    lineHeight: '1.6'
  meta-label:
    fontFamily: '{typography.sans-stack.fontFamily}'
    fontSize: 11.5px
    fontWeight: '400'
    lineHeight: '1.4'
    letterSpacing: 0.26em
    note: 'uppercase'
  wordmark:
    fontFamily: '{typography.sans-stack.fontFamily}'
    fontSize: 17.5px
    fontWeight: '600'
    lineHeight: '1.2'
    letterSpacing: -0.01em
    note: 'Nav wordmark, desktop. 13.5px on mobile. Not tracked caps: at 0.32em the full name measures about 198px and cannot sit beside three inline nav items at 375px.'
  nameline:
    fontFamily: '{typography.sans-stack.fontFamily}'
    fontSize: 12.5px
    fontWeight: '400'
    lineHeight: '1.4'
    letterSpacing: 0.32em
    note: 'uppercase'
  kicker:
    fontFamily: '{typography.sans-stack.fontFamily}'
    fontSize: 13px
    fontWeight: '600'
    lineHeight: '1.4'
    letterSpacing: 0.3em
    note: 'uppercase'
  stage-number:
    fontFamily: '{typography.sans-stack.fontFamily}'
    fontSize: 10.5px
    fontWeight: '400'
    lineHeight: '1.4'
    letterSpacing: 0.2em
    note: 'font-variant-numeric: tabular-nums'
  data-row:
    fontFamily: '{typography.sans-stack.fontFamily}'
    fontSize: 15.5px
    fontWeight: '400'
    lineHeight: '1.62'
    note: 'The data-row role. State line, facts-strip value, key-value key and value, and the call-to-action link. Weight 600 is set by the component, not by a second token. Tabular figures on any numeric value.'
  data-row-mobile:
    fontFamily: '{typography.sans-stack.fontFamily}'
    fontSize: 14.5px
    fontWeight: '400'
    lineHeight: '1.6'
  route-link:
    fontFamily: '{typography.sans-stack.fontFamily}'
    fontSize: 25.5px
    fontWeight: '400'
    lineHeight: '1.24'
    letterSpacing: -0.015em
    note: 'Contact hero routes only. Sans under C2, down 8 percent on the family change. Memlog entry 45.'
  route-link-mobile:
    fontFamily: '{typography.sans-stack.fontFamily}'
    fontSize: 21px
    fontWeight: '400'
    lineHeight: '1.26'
    letterSpacing: -0.015em
  wordmark-mobile:
    fontFamily: '{typography.sans-stack.fontFamily}'
    fontSize: 13.5px
    fontWeight: '600'
    lineHeight: '1.2'
    letterSpacing: -0.01em
  wordmark-footer:
    fontFamily: '{typography.sans-stack.fontFamily}'
    fontSize: 20px
    fontWeight: '600'
    lineHeight: '1.2'
    letterSpacing: -0.01em
    note: 'Footer mark. Sans under C2.'
  wordmark-footer-mobile:
    fontFamily: '{typography.sans-stack.fontFamily}'
    fontSize: 17px
    fontWeight: '600'
    lineHeight: '1.2'
    letterSpacing: -0.01em
  card-title-mobile:
    fontFamily: '{typography.sans-stack.fontFamily}'
    fontSize: 18px
    fontWeight: '600'
    lineHeight: '1.26'
    letterSpacing: -0.02em
  subsection-title-mobile:
    fontFamily: '{typography.sans-stack.fontFamily}'
    fontSize: 21px
    fontWeight: '600'
    lineHeight: '1.2'
    letterSpacing: -0.03em
  pull-quote-mobile:
    fontFamily: '{typography.serif-stack.fontFamily}'
    fontSize: 23px
    fontWeight: '400'
    lineHeight: '1.34'
    letterSpacing: -0.015em
  dek-mobile:
    fontFamily: '{typography.sans-stack.fontFamily}'
    fontSize: 17.5px
    fontWeight: '400'
    lineHeight: '1.6'
  body-lead-mobile:
    fontFamily: '{typography.sans-stack.fontFamily}'
    fontSize: 17.5px
    fontWeight: '400'
    lineHeight: '1.68'
rounded:
  DEFAULT: '0'
  full: 9999px
  dot: 50%
spacing:
  margin-desktop: 84px
  margin-mobile: 22px
  section-desktop: 150px
  section-mobile: 62px
  band-desktop: 120px
  band-mobile: 56px
  column-gap-desktop: 76px
  card-gap: 26px
  stack-xl: 44px
  stack-lg: 34px
  stack-md: 26px
  stack-sm: 14px
  stack-xs: 8px
  rule-hairline: 1px
  rule-card: 2px
  measure-body: 66ch
  measure-caption: 34em
  hero-plate-desktop: 480px x 372px
  hero-plate-mobile: 264px x 330px
  contact-plate-desktop: 420px x 520px
  contact-plate-mobile: 264px x 340px
  handson-plate: 168px x 168px
components:
  nav:
    background: '{colors.paper}'
    padding: 30px {spacing.margin-desktop}
    padding-mobile: 16px {spacing.margin-mobile}
    link: '{colors.muted}'
    link-current: '{colors.accent}'
    current-underline: 1px solid {colors.accent}
    wordmark: '{typography.wordmark}'  # sans, 17.5px 600. {typography.wordmark-mobile} at 375px
  hero-plate:
    background: linear-gradient(168deg, {colors.tone} 0%, {colors.tone-2} 100%)
    border: '{spacing.rule-hairline} solid {colors.rule}'
    radius: '{rounded.DEFAULT}'
    fit: 'object-fit: cover, tuned object-position, never a pre-cropped asset'
  evidence-band:
    background: '{colors.paper}'
    background-dark: '{colors.deep}'
    figure: '{typography.figure}'
    caption: '{typography.dek} in {colors.muted}, or {colors.deep-muted} on dark'
    tag: '{typography.meta-label} in {colors.muted}, or {colors.deep-accent} on dark'
    divider: '{spacing.rule-hairline} solid {colors.rule}'
  figure-pair:
    background: transparent
    figure: '{typography.figure-inline}'
    label: '{typography.meta-label} in {colors.muted}, uppercase, one line from 768px; may wrap to two below'
    label-gap: 4px
    row-gap: 12px
    divider: none
    note: 'Above-the-fold only. Two stacked full-width rows, each one caps scope label above one serif figure. Never a reveal target, never nested in {components.evidence-band}, never more than two rows.'
  cta-link:
    color: '{colors.accent}'
    underline: 1.5px solid {colors.accent}
    weight: '600'
    size: '{typography.data-row}'  # 15.5px, {typography.data-row-mobile} at 375px
  capability-chip:
    border: '{spacing.rule-hairline} solid {colors.chip-border}'
    radius: '{rounded.full}'
    padding: 11px 20px
    padding-mobile: 9px 15px
    text: '{typography.ui}'
    selected-background: '{colors.accent}'
    selected-text: '{colors.on-accent}'
    selected-mark: 'check glyph, the visually hidden text ", selected", and aria-current="true". Never aria-pressed: the chip is a link. See EXPERIENCE.md Capability Filter Contract'
  evidence-card:
    top-rule: '{spacing.rule-card} solid {colors.ink}'
    eyebrow: '{typography.meta-label} in {colors.muted}'
    title: '{typography.card-title}'
    metric: '{typography.body} at 600 in {colors.accent}, font-variant-numeric: tabular-nums'  # sans under C2
    summary: '{typography.small}' in {colors.muted}
    link: '{components.cta-link}'
  state-line:
    text: '{typography.data-row}' in {colors.muted}
    emphasis: '{colors.ink} at 600'
  cross-listing-link:
    type: '{typography.ui}'
    color: '{colors.accent}'
    decoration: 'underline 1px, text-underline-offset 3px'
    count-prefix: '{typography.meta-label}'
    note: 'Realises FR-19. Never styled as a button; it is a route change.'

  empty-state:
    background: '{colors.panel}'
    border: '{spacing.rule-hairline} solid {colors.rule}'
    padding: 36px 40px
    text: '{typography.body}' in {colors.ink}
    link: '{colors.accent} at 600'
  sequence-stage:
    dot: 19px circle, 1.5px {colors.accent} border, filled {colors.accent} when reached
    connector: '{spacing.rule-hairline} {colors.rule}'
    number: '{typography.stage-number}'
    label: '{typography.body}' at 600 in {colors.ink}
    detail: '{typography.small}' in {colors.muted}
  decision-table:
    header: '{typography.meta-label} in {colors.muted}'
    rule: '{spacing.rule-hairline} solid {colors.rule}'
    winning-row: tonal shift to {colors.tone}, never colour alone  # was {colors.panel} at 1.04:1 on paper, which is not perceivable
    verdict-marks: filled, barred and open glyphs, each with a text label
  facts-strip:
    rule: '{spacing.rule-hairline} solid {colors.rule}'
    term: '{typography.meta-label}' in {colors.muted}
    value: '{typography.data-row}' at 600 in {colors.ink}
  section-rail:
    item: '{typography.ui} in {colors.muted}'
    current: '{colors.accent}' at 600
    counter: decimal-leading-zero in {typography.stage-number}
    top-rule: '{spacing.rule-hairline} solid {colors.rule}'
  outcome-band:
    background: '{colors.deep}'
    figure: '{typography.figure-small}'  # evidence figure, one of the four serif roles. Demotion rule in Typography
    caption: '{typography.dek}' in {colors.deep-muted}
    tag: '{typography.meta-label} in {colors.deep-accent}'
  kv-list:
    row-rule: '{spacing.rule-hairline} solid {colors.rule}'
    key: '{typography.data-row}' in {colors.muted}
    value: '{typography.data-row}' at 600, tabular-nums, in {colors.ink}
  source-note:
    border-left: '{spacing.rule-card} solid {colors.tone-2}'
    text: '{typography.small}' in {colors.muted}
  contact-hero:
    background: '{colors.deep}'
    plate-ground: '{colors.studio-ground}'
    heading: '{typography.page-title}' in {colors.on-deep}
    route-link: '{typography.route-link}' in {colors.on-deep}  # sans under C2, down 8 percent on family change
    route-link-underline: 1.5px solid {colors.deep-accent}  # 7.87:1 on deep. Non-colour affordance, see EXPERIENCE.md Accessibility Floor
    row-rule: '{spacing.rule-hairline} solid {colors.deep-rule}'
  footer:
    background: '{colors.panel}'
    top-rule: '{spacing.rule-hairline} solid {colors.rule}'
    wordmark: '{typography.wordmark-footer}'  # footer mark, sans under C2
    link: '{colors.ink}' with a 1px {colors.muted} underline  # 7.82:1 on panel. {colors.rule} measured 1.06:1 and was not perceivable
  rail-group-header:
    text: '{typography.meta-label}' in {colors.ink} at 600
    letterSpacing: 0.18em
    spacing: '{spacing.stack-md}' above, {spacing.stack-xs} below. First header has no top gap
    rule: none
    counter: 'none. The rail counter runs continuously through the groups and is never reset'
  tradeoff-pair:
    item-rule: '{spacing.rule-hairline} solid {colors.rule}' above each trade-off item
    heading: '{typography.card-title}' in {colors.ink}
    layout: two equal columns at {spacing.card-gap} on desktop, one stacked column at 375px
    label: '{typography.meta-label}' in {colors.muted}
    buys-rule: '{spacing.rule-hairline} solid {colors.tone-2}' above the What it buys column
    costs-rule: '{spacing.rule-card} solid {colors.ink}' above the What it costs column
    text: '{typography.data-row}' in {colors.muted}
  repo-cta:
    background: '{colors.accent}'
    radius: '{rounded.DEFAULT}'
    padding: 26px 30px 28px
    max-width: 660px
    kicker: '{typography.meta-label}' in {colors.on-accent}
    title: '{typography.route-link}' at 600 in {colors.on-accent}, underlined {spacing.rule-card} solid {colors.on-accent}
    url: '{typography.ui}' in {colors.on-accent}, word-break break-word
    note: '{typography.small}' in {colors.on-accent}
    focus-ring: '{colors.focus-ring}'  # the panel sits on {colors.paper}. See Focus indicator
  repo-cta-rail:
    background: '{colors.accent}'
    radius: '{rounded.DEFAULT}'
    padding: 14px 15px 15px
    kicker: '{typography.stage-number}' in {colors.on-accent}
    title: '{typography.ui}' at 600 in {colors.on-accent}, underlined {spacing.rule-hairline} solid {colors.on-accent}
    focus-ring: '{colors.focus-ring}'  # sits on {colors.paper} at desktop and on {colors.panel} in the mobile rail box
---

# Foundry, the ShahrouzPortfolio visual identity

Peer contract to `EXPERIENCE.md`. This file owns how the site looks. Behaviour, states, flows and the accessibility floor live in `EXPERIENCE.md`. Both spines win over any mockup in `mockups/`. Where a mockup disagrees with a spine, the mockup is stale. Earlier exploration in `.working/` is historical record only and carries no authority.

Reference renders: `mockups/direction-f1-foundry.html` (the chosen direction), `mockups/screen-home.html`, `mockups/screen-experience.html`, `mockups/screen-case-study.html`, `mockups/screen-ai-case-study.html`, `mockups/screen-contact.html`, `mockups/screen-project.html`, `mockups/diagram-system.html`. Where a render and this file disagree, this file wins.

## Brand and Style

The governing strategy, in Shahrouz's own words:

> Photography can establish me as the person, while diagrams should establish how I think as an engineering leader.

Everything below follows from that sentence. The portrait appears exactly twice at scale on the whole site, plus one 168px hands-on frame (see `EXPERIENCE.md` Imagery Rules) and is never asked to carry a screen. The engineering material is the product photography: figures, sequences and one decision model get the scale and the silence a product shot would get in someone else's system.

The second governing fact is that this is an **impression surface, not an information-transfer one**. The resume carries completeness, so the site is free to be selective and to spend its budget on craft. Design quality here is load-bearing rather than decorative.

The posture is **F1 Foundry**: warm serif display on ivory, museum-wall pacing, one idea on screen at a time with air around it, and a single deep oxide accent that appears perhaps four times on an entire page. Editorial authority without any literal newspaper furniture. No mastheads, no bylines, no decorative column rules. The restraint is what reads as expensive.

Target feeling, his words: a senior technology leader with taste, substance and technical depth.

Voice in copy is plain, specific and measured. Numbers in preference to adjectives. First person used sparingly. Never breathless about AI. Microcopy rules live in `EXPERIENCE.md.Voice and Tone`.

## Colors

The palette is settled and contrast-checked. It is not a starting point for a theme.

- **Paper `{colors.paper}`** is the ground for every route except Contact. Warm ivory, never white, never grey.
- **Paper-alt `{colors.paper-alt}`** and **Panel `{colors.panel}`** are the only two tonal steps above paper. Alt carries an alternating full-width section band, panel carries the footer, the empty state and the mobile section rail. There is no third step.
- **Ink `{colors.ink}`** is primary text at 16.6:1 on paper, and the 2px card rule.
- **Muted `{colors.muted}`** is secondary text at 7.3:1. Captions, navigation links at rest, source notes, stage details.
- **Rule `{colors.rule}`** is decorative hairline only. Nothing legible is ever set in it.
- **Tone `{colors.tone}` and Tone-2 `{colors.tone-2}`** are the plate ground behind photography, a soft 168 degree gradient that reads as paper stock rather than as a UI surface. Tone-2 also draws the source-note left rule.
- **Accent `{colors.accent}`**, the deep oxide, at 8.6:1 on paper. Its whole authority comes from scarcity. It is allowed on: links and the call to action, the selected capability chip, the current navigation item, the case-study eyebrow, the headline metric on a card, the sequence stage dot, the availability dot, the section-rail current item, and the repository call-to-action panel `{components.repo-cta}` with its rail repeat `{components.repo-cta-rail}`. Nothing else. If a page needs another oxide mark outside that list, remove one instead of adding it.
  - **The repository call to action is a named exemption, with its count.** On `/projects/[slug]` only, the oxide appears as two solid fills (the panel above the fold and the block pinned to the foot of the sticky rail) plus the outcome band carrying the repository URL, which is three marks on one page before the ordinary link and eyebrow uses. The reason: UJ-3 resolves on that link. Flow 3 in `EXPERIENCE.md` makes the repository the conversion moment for a sceptical Principal Engineer, and a page that buries it inverts the journey into active damage. `.memlog.md` entry 38 records the three-mark treatment as deliberate, and this bullet is what stops the spines-win rule deleting it. The exemption is scoped: it applies to `/projects/[slug]` and to no other route, and a solid accent fill appears nowhere else on the site.
  - Because an accent fill is a surface and not a mark, the four-mark page budget in Do's and Don'ts counts `{components.repo-cta}` and `{components.repo-cta-rail}` as one decision, not two, and the project detail route is allowed six marks in total against the usual four.
- **On-accent `{colors.on-accent}`** is the only text colour permitted on an accent fill, at 8.2:1.
- **Deep `{colors.deep}`** is the dark ground, used for exactly three things: the quality evidence band on Home, the outcome band on a case study, and the whole Contact hero. With **On-deep `{colors.on-deep}`** at 15.9:1, **Deep-muted `{colors.deep-muted}`** at 8.4:1, **Deep-accent `{colors.deep-accent}`** at 7.6:1 and **Deep-rule `{colors.deep-rule}`** for hairlines on dark.
- **Studio-ground `{colors.studio-ground}`** exists only behind the black-background studio portrait on Contact, so the photograph meets the deep hero edge to edge rather than floating as a black rectangle on ivory.
- **Chip-border `{colors.chip-border}` `#8E7E68`** is the unselected chip outline, at **3.69:1 on paper**, 3.45:1 on panel and 3.39:1 on paper-alt. It is a user-interface boundary, not decoration, so it is held to the WCAG 1.4.11 non-text minimum of 3:1 rather than to the hairline standard. The previous value `#C9B9A4` measured 1.80:1 on paper and failed: the pill border is the only thing that identifies an unselected chip as a control, so an imperceptible border makes the control imperceptible. `{colors.rule}` remains the decorative hairline and is never used for a control boundary.

There is no dark mode. The dark grounds are compositional decisions on specific bands, not a theme. Dark-mode-as-personality is an explicit anti-goal.

No information is carried by colour alone anywhere in the palette. See `EXPERIENCE.md.Accessibility Floor`.

## Typography

Two families, neither of them a web font, so the page makes zero network requests for type.

### The rule: serif for voice, sans for instrument

Serif is what he says. Sans is what he measured. This is the **C2 calibration**, chosen at sign-off after serif was found to be over-applied: when serif marks a hero headline and a card title identically, neither reads as special.

**Serif `{typography.serif-stack.fontFamily}` carries exactly four roles, and nothing else.**

| Role | Token |
|---|---|
| Hero headline | `{typography.display-hero}`, `{typography.display-hero-mobile}` |
| Page title, one per route | `{typography.page-title}`, `{typography.page-title-mobile}` |
| Evidence figures | `{typography.figure}`, `{typography.figure-small}`, and their mobile ramps |
| Pull quotes and outcome statements | `{typography.pull-quote}` |

**Sans `{typography.sans-stack.fontFamily}` carries everything else**: section and subsection headings, card titles, body copy at every size, navigation, capability chips, table content, specification rows, metadata, captions and every caps label.

The test for a new element nobody specified: is this something he is saying, or something he is showing? Saying is serif, and it is almost never saying. Showing is sans.

### Why the sizes changed when the family did

**Serif and sans do not read at the same size.** The system sans has a larger x-height than the Iowan Old Style stack, so a token moved from one family to the other must be resized or the hierarchy visibly breaks. These adjustments are part of the calibration, not optional polish:

- **Display roles moving to sans came down about 8 percent**, with tracking tightened from `-0.02em` to `-0.03em`: section title 38 to 35, subsection title 34 to 31, card title 23 to 20.5.
- **Text roles moving to sans came down about 3 percent**, with leading opened slightly: hero support 21 to 19.5 at `1.56`, mobile support 15.5 to 15 at `1.6`.
- **Nothing below 13.5px was moved in either direction**, so the accessibility floor and every checked colour pairing still stand.

### Remaining rules

- Display and figure sizes take negative tracking (`-0.025em` at hero, `-0.04em` at figure) and near-solid leading. Large type is set as a block, not as lines.
- Every number rendered at scale uses tabular figures: `{typography.figure}`, `{typography.stage-number}`, `{components.kv-list}` values. Card metrics moved to sans keep tabular figures.
- Caps labels are always tracked out between `0.2em` and `0.32em`: `{typography.meta-label}`, `{typography.nameline}`, `{typography.kicker}`. Caps are never used for anything longer than five words.
- Body measure is capped at `{spacing.measure-body}`. Evidence captions cap at `{spacing.measure-caption}`.
- One h1 per route. Heading order is never skipped for visual size; size comes from the token, not from the tag.
- Mobile is a separate ramp, not a scale factor. `{typography.display-hero}` at 76px becomes `{typography.display-hero-mobile}` at 34px, and `{typography.figure}` at 164px becomes `{typography.figure-mobile}` at 80px. A long figure phrase such as "above 100% to below 20%" drops to `{typography.figure-small-mobile}` and is allowed to break across two lines.

**The nav wordmark has its own token, `{typography.wordmark}`, and the reason matters.** Serif was considered and rejected: at nav scale it adds no expressive value and would turn four clean exceptions into five with a fuzzy one. Tracked small caps (`{typography.nameline}`) was then specified and also proved wrong: at `0.32em` the full name measures about 198px and cannot sit beside three inline nav items at 375px, where there is no disclosure menu to hide behind. So the wordmark is sans at 17.5px desktop and 13.5px mobile, untracked, weight 600. If it is ever rendered at display scale it becomes a serif role.

### The ramp is closed. No raw type sizes in the components block

Every **type-bearing** value in the `components` frontmatter resolves to a `typography` token. A raw pixel size in a component is a defect, because a builder composing an unmocked component copies the nearest component, and an off-ramp value propagates. Geometry (padding, dot diameter, rule weight, panel max-width) stays literal and is not part of the ramp.

Eight sizes previously sat in `components` and nowhere in the ramp. They are reconciled as follows, and this table is the record of what changed:

| Was, raw | Where | Now | Effect |
|---|---|---|---|
| 96px | `outcome-band.figure` | `{typography.figure-small}` 104px | Up 8px. The outcome figure is the same role as the small evidence figure and there is no reason for two |
| 28px, now 25.5px | `contact-hero.route-link` | New token `{typography.route-link}` 25.5px | No change. The value is fixed by memlog entry 45 and now has a name |
| 22px, now 20px | `footer.wordmark` | New token `{typography.wordmark-footer}` 20px | No change. Named so it is not confused with `{typography.dek}`, which is 20px at weight 400 |
| 19px | `outcome-band.caption` | `{typography.dek}` 20px | Up 1px. Same leading, same role |
| 18px, now 17.5px | `nav.wordmark` | `{typography.wordmark}` | No change, now referenced as a whole token |
| 15.5px and 15px | `state-line.text`, `facts-strip.value`, `kv-list.key`, `kv-list.value`, `cta-link.size` | New token `{typography.data-row}` 15.5px | The call-to-action link goes 15 to 15.5. Five components, one role, one token |
| 14px and 13px | `evidence-card.summary`, `sequence-stage.detail` | `{typography.small}` 13.5px | Card summary down 0.5px, stage detail up 0.5px |
| 11px | `facts-strip.term` | `{typography.meta-label}` 11.5px | Up 0.5px, tracking 0.2em to 0.26em. It is a caps label and `meta-label` is the caps-label role |

`17px` in `evidence-card.metric`, `empty-state.text` and `sequence-stage.label` was already the ramp's `{typography.body}` and now says so.

### Figure demotion

Named because the ramp now has three figure sizes and the rule for choosing between them was previously unwritten (see Open items).

**Step one, by length.** Count rendered characters in the figure phrase.

| Figure content | Token |
|---|---|
| Up to 14 characters, for example `20% to 76%` | `{typography.figure}` 164px |
| 15 to 32 characters, for example `above 100% to below 20%` | `{typography.figure-small}` 104px |
| Longer than 32 characters, or a URL | `{typography.pull-quote}` 31px, still serif, still an outcome-slot figure |

**Step two, by company.** A figure that shares a band with other figures demotes **one further step**. A figure alone in its band does not. This is why `mockups/screen-home.html` sets the third Home figure `20% to 76%` at `{typography.figure-small}` while `mockups/direction-f1-foundry.html` sets it at `{typography.figure}`: the screen renders the three-up evidence row and is correct, the direction file renders it alone and is superseded, which is the decision already recorded in Open items. A figure inside `{components.outcome-band}` is always alone, so length alone governs it.

At 375px the same two steps select `{typography.figure-mobile}`, `{typography.figure-small-mobile}` and `{typography.pull-quote-mobile}`. A figure phrase is allowed to break across two lines; it is never allowed to shrink off-ramp to fit.

**Step three, the one exemption.** A figure inside `{components.figure-pair}` is governed by neither step above. It always uses `{typography.figure-inline}` at every width. Written because the two steps produce a mismatched pair there: `20% to 76%` is 10 characters and selects `{typography.figure-mobile}` 80px, demoting to `{typography.figure-small-mobile}` 40px, while `above 100% to below 20%` is 23 characters and selects `{typography.figure-small-mobile}` 40px, demoting to `{typography.pull-quote-mobile}` 23px. That is 40px beside 23px for two figures of equal evidentiary weight. The exemption was chosen over a longest-phrase-wins rule because that would have changed how every evidence band sizes too, to fix a problem only the pair has.

### The mobile ramp, and what happens to roles without one

Mobile tokens now exist for `display-hero`, `page-title`, `figure`, `figure-small`, `section-title`, `subsection-title`, `card-title`, `pull-quote`, `dek`, `body-lead`, `support`, `body`, `data-row`, `route-link`, `wordmark` and `wordmark-footer`.

**Fallback rule for every remaining role.** `{typography.ui}`, `{typography.small}`, `{typography.meta-label}`, `{typography.nameline}`, `{typography.kicker}` and `{typography.stage-number}` are identical at 375px and 1440px and have no mobile token by decision, not by omission. They already sit at or just above the floor, and nothing below 13.5px is ever rendered at any width. If a role has no `-mobile` token, use the desktop token unchanged. **Do not derive a mobile size by scaling**; that is the thing this ramp exists to prevent.

**If warmth is missed once C2 is live**, add it to one element rather than a section class: return serif to the case study dek alone. That is a one-line change and it does not reintroduce a rule a reader has to infer.

## Layout and Spacing

A single centred measure with generous side margins, not a visible grid. `{spacing.margin-desktop}` on desktop, `{spacing.margin-mobile}` on mobile, and the mobile margin is a floor: nothing bleeds to the edge of a phone.

- **Pacing is the design.** Full-width sections separated by `{spacing.rule-hairline}` hairlines in `{colors.rule}`, with `{spacing.section-desktop}` of vertical padding on an evidence band and `{spacing.band-desktop}` on a content band. Mobile compresses to `{spacing.section-mobile}` and `{spacing.band-mobile}`, which is compression of the gap, not of the type.
- **Hero** is a two-column grid, text column plus a fixed `{spacing.hero-plate-desktop}` plate, separated by `{spacing.column-gap-desktop}`. The plate is roughly 36 percent of the band. On mobile the hero is a single block: statement first, then a contained `{spacing.hero-plate-mobile}` plate.
- **Case study** is a `212px` sticky rail plus a `{spacing.measure-body}` body column at `{spacing.column-gap-desktop}`. On mobile the rail becomes a static `{colors.panel}` box above the body.
- **Card grids** are three equal columns at `{spacing.card-gap}` on desktop, one column on mobile.
- **Alternating ground** is how a long scroll stays paced: paper, deep, paper, paper-alt. Never two dark bands in a row.
- Vertical rhythm inside a block uses `{spacing.stack-xl}` down to `{spacing.stack-xs}`. The largest gaps sit between ideas, the smallest between a label and the thing it labels.

## Elevation and Depth

There is no elevation. No shadows, no cards that lift, no hover raise, no layered surfaces.

Depth comes from three devices only:

1. **Tonal ground.** `{colors.paper}`, `{colors.paper-alt}`, `{colors.panel}`, `{colors.deep}`.
2. **Hairline rules.** `{spacing.rule-hairline}` in `{colors.rule}` between sections and list rows, `{spacing.rule-card}` in `{colors.ink}` above a card.
3. **Scale.** A 164px figure against 17px body copy is the whole hierarchy.

A shadow anywhere on this site is a defect.

## Shapes

Square. `{rounded.DEFAULT}` is `0` and it is the default for every surface, plate, photograph, band, card and panel. Photographs are rectangles with a hairline border, never rounded, never masked.

Two exceptions, both deliberate:

- `{rounded.full}` on the capability chip, because a pill is the one shape that reads unambiguously as a toggle.
- `{rounded.dot}` on the sequence stage dot and the availability dot, both 8 to 19px, both decorative.

## Components

Full visual specs live in the `components` frontmatter block. The notes below carry the reasoning. Behavioural rules live in `EXPERIENCE.md.Component Patterns`.

- **Navigation `{components.nav}`.** A wordmark in sans and a flat list of routes. The current route is the only oxide mark in the header, carrying both colour and a 1px underline. No logo, no disclosure menu at any width, no sticky header on scroll.
- **Hero plate `{components.hero-plate}`.** The portrait is an editorial object, never full-bleed. Gradient tone ground, hairline border, `object-fit: cover` with a tuned `object-position`. Desktop and mobile are two crops of one file. A caption label sits bottom-left over a translucent ink scrim only where the render calls for it.
- **Evidence band `{components.evidence-band}`.** One caps tag, one figure, one caption. Nothing else may enter this band. The dark variant inverts to `{colors.deep}` and drops its top rule.
- **Figure pair `{components.figure-pair}`.** Above the fold on Home, and nowhere else. Two stacked full-width rows, each one `{typography.meta-label}` caps scope label above one `{typography.figure-inline}` serif figure, one line from 768px and two at most below it. Its two labels are named in UX-DR27 and are the only caps runs allowed past five words. No tag, no divider, no background, never more than two rows. It exists because `{components.evidence-band}` cannot serve above the fold: that band permits one figure and reveals on scroll, and an above-fold element must never be a reveal target. The scope label is the figure's own sentence, which is how FR-34 is satisfied without a separate caption.
- **Capability chip `{components.capability-chip}`.** Fixed order at all widths: Leadership, AI-Native, Executive Influence, Hands-On. Selected state carries an oxide fill, a check glyph and a visually hidden ", selected", three signals for one state. Chips wrap to a second line at 375px. They never enter a horizontal scroller.
- **Evidence card `{components.evidence-card}`.** A 2px ink rule on top, a capability eyebrow in full-name form, a sans title, the headline metric in oxide, a one-line summary, and a text link. No image, no shadow, no border box.
- **State line `{components.state-line}`.** A written sentence directly under the chips. It is a first-class component, not helper text.
- **Cross-listing link `{components.cross-listing-link}`.** The link that carries a visitor from one listing to matching evidence on the other, realising FR-19. Set in `{typography.ui}`, `{colors.accent}`, underlined at `1px` with a `3px` offset so the affordance is not colour alone, preceded by the count in `{typography.meta-label}`. It sits directly beneath the filter state line on a listing, and is the FIRST element inside `{components.empty-state}` when a selection returns nothing on the current route. It is never styled as a button: it is a route change, not an action.
- **Empty state `{components.empty-state}`.** A bordered panel with explanatory prose and the cross-listing link first. Never a blank container, never a spinner, never a bare "no results".
- **Sequence stage `{components.sequence-stage}`.** One ordered-list item: dot, zero-padded number, label, detail. Horizontal row on desktop with a hairline connector at the top edge, vertical rail on mobile with the connector on the left edge. Identical markup at both widths.
- **Decision table `{components.decision-table}`.** The single bespoke technical visual in V1. Candidate rows against three independent gates plus an outcome. The winning row is marked tonally and in words. Verdict marks are glyph plus text, never glyph alone.
- **Facts strip `{components.facts-strip}`.** A rule-bounded definition list under a case-study title. Term in caps, value in 600. Stacks vertically at 375px.
- **Section rail `{components.section-rail}`.** Sticky numbered list of a route's sections, oxide on the current one. Five sections on a case study, eight on a project detail. Numbering is continuous across the whole rail at both lengths.
- **Rail group header `{components.rail-group-header}`.** The device that makes eight sections read as three. A caps label above a run of rail items, in ink at 600 rather than oxide, so it reads as a divider and does not spend an accent mark. On `/projects/[slug]` the three headers are The build, What it cost, What came of it. The rail counter is never reset by a header: the items still run 01 to 08. Used only when a rail carries more than six items.
- **Trade-off pair `{components.tradeoff-pair}`.** The two-column What it buys against What it costs block inside a decisions or trade-offs list. Both sides carry a caps word label, so the distinction is never carried by position or colour. The two sides are separated by rule weight rather than by hue: `{spacing.rule-hairline}` in `{colors.tone-2}` above the buys column, `{spacing.rule-card}` in `{colors.ink}` above the costs column. `mockups/screen-project.html` draws the costs rule in `{colors.accent}`; that is a stale mockup, because a fifth oxide mark on that page would erode the exemption the repository panel needs. Stacks to one column at 375px, buys first.
- **Repository call to action `{components.repo-cta}` and its rail repeat `{components.repo-cta-rail}`.** A solid oxide panel with the full repository URL set as visible text, so the destination is legible before the click and readable in print. Permitted by the named exemption in Colors, on `/projects/[slug]` only. The whole panel is one anchor, not a panel containing a link, so there is exactly one tab stop and one target. It takes `{colors.focus-ring}` because it sits on paper: see Focus indicator. The rail repeat is the same anchor at rail scale, pinned to the foot of the sticky rail so the call travels the whole scroll; both carry the same accessible name.
- **Outcome band `{components.outcome-band}`.** Full-bleed deep ground lifting the headline figure out of the prose, with its qualifier in the same sentence.
- **Key and value list `{components.kv-list}`.** Repeats the numbers for a reader who skipped the prose. Tabular figures, hairline rows.
- **Source note `{components.source-note}`.** Left-ruled small text stating where a number came from and how strong the instrument is. It appears before it is asked for.
- **Contact hero `{components.contact-hero}`.** Whole-width deep ground so the black-background studio portrait meets it edge to edge. Two routes, email then LinkedIn, each a sans link with a caps label above and a plain sentence below.
- **Footer `{components.footer}`.** Three columns on panel ground. Wordmark, positioning line, location, availability. Evidence links. Contact links. A closing note about the absence of a CV.

### Focus indicator

Required by the accessibility floor and by NFR-2. Two ring colours exist because one cannot serve both grounds.

| Property | Value |
|---|---|
| Style | `2px solid` outline |
| Offset | `2px`, and the offset is load-bearing |
| Colour on light surrounding ground | `{colors.focus-ring}` `#7E2E16` |
| Colour on deep surrounding ground | `{colors.focus-ring-on-deep}` `#E3A57E` |
| Radius | Follows the focused element's own radius |
| Minimum contrast | **3:1**, WCAG 1.4.11, measured **between the ring and the surrounding ground** |

**The ring colour is chosen by the ground the element sits on, not by the element's own fill.**

This is the whole rule and it is easy to get backwards. With `outline-offset: 2px` the ring is drawn entirely **outside** the element. It is never painted on the element's own background. The variable is the surrounding ground, and nothing else.

| Surrounding ground | Ring token | Measured ratio |
|---|---|---|
| `{colors.paper}` `#FBF7F1` | `{colors.focus-ring}` | 8.59:1 |
| `{colors.paper-alt}` `#F4EDE2` | `{colors.focus-ring}` | 7.89:1 |
| `{colors.panel}` `#F6EFE4` | `{colors.focus-ring}` | 8.03:1 |
| `{colors.tone}` `#EFE4D3` | `{colors.focus-ring}` | 7.30:1 |
| `{colors.tone-2}` `#DCCDB6` | `{colors.focus-ring}` | 5.88:1 |
| `{colors.deep}` `#241D18` | `{colors.focus-ring-on-deep}` | 7.87:1 |
| `{colors.studio-ground}` `#0C0A08` | `{colors.focus-ring-on-deep}` | 9.36:1 |

**Worked example, an accent-filled element on paper.** `{components.repo-cta}` on `/projects/[slug]` is a solid `{colors.accent}` `#7E2E16` panel sitting in a `{colors.paper}` section. The element looks dark, so the instinct is to reach for the deep ring. That is wrong, and it produces `#E3A57E` on `#FBF7F1` at **1.98:1**, a ring that is effectively invisible on the single highest-stakes control on the site. The correct choice is `{colors.focus-ring}` `#7E2E16` at **8.59:1** against the paper the offset gap and the ring are both drawn on. The same applies to `{components.repo-cta-rail}` and to the selected `{components.capability-chip}`, which are also accent fills on light grounds.

Rules:

- Before shipping any new interactive element, measure the ring against **the ground behind the element**, not against the element. If it does not reach 3:1, the element is on the wrong ground or the ring is the wrong token.
- The `2px` offset must never be set to `0`. On an accent fill, a zero-offset `{colors.focus-ring}` ring is `#7E2E16` on `#7E2E16`, which is 1.00:1 and invisible. The gap is part of the indicator.
- An element that straddles two grounds, or sits inside the mobile `{colors.panel}` rail box on an otherwise paper route, takes the ring for the ground immediately around it at that breakpoint.
- `outline: none` is never used without an equivalent replacement in the same rule.
- The indicator is visible on every interactive element: links, capability chips, the section rail anchors, the repository call to action and its rail repeat, and form controls if any are ever added.
- Focus is never conveyed by colour change alone. The outline itself is the signal, which satisfies the no-colour-alone rule.
- `:focus-visible` is used so a mouse click does not draw a ring, with `:focus` as the fallback for browsers without support.

## Do's and Don'ts

| Do | Don't |
|---|---|
| Keep the oxide accent to about four marks on a page | Add a fifth accent use because a section feels flat |
| Let a figure be enormous and alone | Put two figures in one band |
| Set the portrait as a cropped editorial object at about 36 percent width | Stretch the portrait full-bleed, or pre-crop two separate files |
| Use hairlines and tonal ground for structure | Use shadows, elevation, hover lift or rounded cards |
| Square corners everywhere except the chip and the dots | Round photographs, plates, panels or bands |
| Compress the gaps on mobile | Shrink the type ramp instead of redesigning the layout |
| Use tabular figures wherever numbers are set | Let a number reflow between states |
| Carry state with a glyph plus words plus colour | Carry state with colour alone |
| Keep type to the two stacks and zero web fonts | Add a display face, an icon font or a webfont request |
| State a qualifier in the same sentence as its number | Let a figure appear bare anywhere, including in a band |

**Anti-goals, named.** The site must not read as an online resume, a developer portfolio, a SaaS or product documentation site, or an AI-consultant website. Also excluded, each one on sight: terminal aesthetics, animated hero text, particle or gradient backgrounds, skill-percentage bars, technology logo grids, dark-mode-as-personality, abstract-network stock imagery, and literal newspaper furniture. No CSS framework and no component library: plain CSS or CSS Modules.

## Open items

1. **Resolved: focus indicator specified, and the selection rule corrected.** See Components, Focus indicator. Two tokens, `{colors.focus-ring}` on light surrounding grounds and `{colors.focus-ring-on-deep}` on deep. The rule now selects by **the ground the element sits on**, not by the element's own fill, with a per-ground ratio table, a 3:1 minimum stated explicitly, and a worked example for an accent-filled panel on paper. The earlier wording produced a 1.98:1 ring on the repository call to action. Still needs Shahrouz's sign-off rather than being treated as settled.
2. **Nav resolved to three items, with one open product question.** Writing is removed: Engineering Notes was cut from V1, so a nav item pointing at it was simply an error carried through every mock. About remains an open question for Shahrouz, since adding a route is a PRD change. See `EXPERIENCE.md` Open items 2 for the full reasoning.
3. **Resolved: there is no mobile Menu component.** The nav carries three short items inline at every breakpoint, which removed the panel, the close affordance, the focus trap and the keyboard specification from the build entirely. See `EXPERIENCE.md` Open items 3.
4. **Resolved: figure demotion rule written.** See Typography, Figure demotion. Two steps: rendered character count selects `{typography.figure}`, `{typography.figure-small}` or `{typography.pull-quote}`, then a figure sharing a band with other figures demotes one further step. This reproduces the decision already recorded here, that `mockups/screen-home.html` is correct and `mockups/direction-f1-foundry.html` is superseded on "20% to 76%", and it gives a rule for the fourth band nobody has drawn.
5. **Resolved: `chip-border` raised to meet 1.4.11.** `#C9B9A4` measured 1.80:1 on paper and failed the 3:1 non-text minimum for a control boundary. Now `#8E7E68` at 3.69:1 on paper, 3.45:1 on panel, 3.39:1 on paper-alt. Tonally the same family, one step deeper.
6. **Resolved: the shadow type ramp is closed.** Every type-bearing value in `components` now resolves to a `typography` token. Three tokens were added (`data-row`, `route-link`, `wordmark-footer`), eight orphan sizes were mapped, and the change table is in Typography. Nine mobile tokens were added and a fallback rule now covers every role that deliberately has none.
7. **Resolved: the repository call-to-action panel is admitted to the accent allow-list.** Named as an exemption scoped to `/projects/[slug]`, with its reason (UJ-3 resolves on that link) and its count (three marks, six permitted on that route). Without this, the spines-win rule would have silently deleted a deliberate decision recorded in `.memlog.md` entry 38. The trade-off pair's accent cost-rule in the same mockup is **not** admitted and is specified in ink instead, so the exemption stays narrow.
8. **Resolved: the three `mockups/screen-project.html` components are specified.** `{components.rail-group-header}`, `{components.tradeoff-pair}`, `{components.repo-cta}` and `{components.repo-cta-rail}` now carry frontmatter and a Components bullet each, with behaviour in `EXPERIENCE.md.Component Patterns`.
9. **Resolved: the cross-listing link has a visual spec.** `{components.cross-listing-link}` now exists in the frontmatter and in Components prose, covering type, colour, the non-colour affordance, the count prefix and its placement both beneath a filter state line and as the first element of an empty state.
10. **Still open: photography is stand-in.** All three images are AI-enhanced from real source photos at 1311 x 1200, about 1.37x headroom on the desktop hero and 1.50x on the mobile plate. Never upscale beyond natural size. Real photography is governed by `photography-brief.md` and is a post-launch improvement, not a launch blocker.
11. **Still open: second warmer Contact frame not shot.** `photography-brief.md` Shot 2 specifies a warmer no-jacket portrait; the current Contact plate uses the black studio frame instead.
12. **Resolved: `decision-table.winning-row` uses `{colors.tone}`.** The spine named `{colors.panel}`, a 1.04:1 step on paper that is not perceivable, while `mockups/diagram-system.html` used `{colors.tone}`, which is a real one. The mockup was right and the contract was wrong. The winning row also carries the words "The answer", so this was never a colour-alone failure, but the tonal half of the signal was doing nothing.
13. **Resolved 2026-10-07: the above-fold figure pair is specified.** `{components.figure-pair}` and `{typography.figure-inline}` now exist, and Figure demotion carries a third clause exempting the pair. The decisive finding was not the type collision but the vertical budget: **the fold discipline was already impossible before FR-5 was amended.** The previous line claimed identity, the positioning statement, availability and the portrait all sat above the fold at 375px, which overran a 375x667 phone's visible 553px by about 323px, the plate alone being 330px. So the plate and the kicker both move below the fold at 375px, the fold is now defined as 375 x 550, and the measured stack lands at about 525px. See `EXPERIENCE.md` Open items 21 for the composition and the items routed back to John, and Open items 22 for the mockup refresh. Note for item 4 below: `20% to 76%` now has two homes, `{typography.figure-inline}` in the figure pair above the fold and `{typography.figure-small}` in the evidence band below it, so the worked example in Figure demotion still refers correctly to the band.
