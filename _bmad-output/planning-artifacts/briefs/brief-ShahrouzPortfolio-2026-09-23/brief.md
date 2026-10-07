---
title: "Product Brief: Shahrouz Mohaghegh Personal Website (V1)"
status: ready
created: 2026-09-23
updated: 2026-10-07
author: "Mary (Business Analyst), with Shahrouz Mohaghegh"
handoff_to: "John (Product Manager), for PRD"
---

# Product Brief: Shahrouz Mohaghegh Personal Website (V1)

> **Style rule, binding on every downstream artefact.** No em dashes, anywhere: not in this brief, not in the PRD, not in website copy. This is a standing global rule from Shahrouz's `writing-style.md`. It matters beyond taste, because em dashes read as an AI tell to exactly the audience this site is built for.

---

## Executive Summary

Shahrouz Mohaghegh is a senior engineering leader with more than twenty years across banking, payments and regulated healthcare, most recently running a 38-person engineering function at Webstercare with a standing seat on the company's Digital Governance Board. The site is aimed at the people who hire for Head of Engineering, Engineering Director, Chief Engineer and equivalent roles.

This product is a personal website that does one job: **make a recruiter, a CTO or a technical interviewer reach the correct conclusion about him faster than a résumé can.** That conclusion is specific. He leads engineering organisations and transformation, he has never stopped being technically credible, and he understands how AI and agentic engineering are changing software delivery. Not a junior portfolio, not a résumé on the web, not an AI influencer page.

The site is also how he refreshes React, TypeScript, Next.js and Node. That is a **byproduct, not a driver**. Shahrouz has been engineering for twenty years and does not need this project as a learning vehicle. The consequence for scope is decisive and John should enforce it: **no feature earns its place in V1 on learning value alone.**

The binding constraint is capacity. Fifteen hours a week gives a V1 budget of roughly **thirty focused hours**. A smaller polished site that is live and linked from his LinkedIn is worth far more than a sophisticated one still unfinished in week four.

---

## Objectives, in priority order

`docs/scope.md` §3 already ranks these: job-search positioning first, personal technical development second, the AI-native delivery demonstration third. Shahrouz has since reordered the second and third, and demoted learning from an objective to a byproduct. That reordering is authoritative and is reflected below.

1. **Strengthen job-search positioning.** A published, shareable site that lands the leadership-plus-technical-credibility-plus-AI thesis within a short visit. The only objective that can block launch.
2. **Demonstrate an AI-native delivery model in practice.** The site is built with BMAD agents while Shahrouz holds accountability for requirements, architecture, decisions, acceptance criteria and review. Self-executing: it happens by building the thing, and the repository is the evidence.
3. **Refresh hands-on React, TypeScript, Next.js and Node.** Valuable, entirely a byproduct, never a justification for scope.

---

## Who This Serves

Three audiences with different needs, reading at three depths. The site must serve all three without making any of them work.

**Recruiters and talent professionals.** Skimming, often on a phone, often with thirty seconds. They need: seniority band, team size led, domain, availability, and a one-line reason to shortlist. This audience most often decides whether he gets a conversation at all.

**CTOs, CIOs, Heads of Engineering and Engineering Directors.** Evaluating judgement, scale and transformation capability. They need: what he owned, what changed as a result, how he thinks about operating models and people, and evidence he has done it in a regulated environment. They read for decisions and trade-offs, not technology lists.

**Chief Engineers, Principal Engineers and technical interviewers.** Looking for what is hardest to fake. They need: architecture he designed, code he wrote, systems he shipped, a public repository they can open, and an honest account of what he would change. This audience is the most sceptical of AI claims, so evidence has to be strongest here.

### Core visitor journeys

| Journey | Audience | Path | Success |
|---|---|---|---|
| **The 30-second skim** | Recruiter | Home only | Can state his level, scale and availability without scrolling past the first screen |
| **The 5-minute assessment** | CTO / Head of Eng | Home, then Experience, then one case study | Can name two measurable outcomes he personally drove |
| **The deep drill** | Chief / Principal Eng | Home, then Projects, then GitHub | Opens the repository, and finds architecture documentation rather than a toy |
| **The targeted check** | Any, pre-interview | Capability filter, then matching evidence | Finds evidence on the one capability they care about in under a minute |

---

## Positioning

**The thesis:** a senior engineering leader who remains technically credible and understands how AI and agentic engineering are changing software engineering systems.

**Leadership-first, not technology-first.** React, Next.js, Azure, .NET and AI are evidence supporting the positioning, not the positioning itself. Content focuses on decisions, systems, trade-offs, outcomes and lessons.

### A finding that should shape the homepage

The most important analytical point in this brief, and it cuts against instinct.

An audit of his past positioning against senior engineering position descriptions found two things:

- **His strongest and most defensible number is the one he uses least.** The offshore delivery turnaround, bug reopen rate above 100% down to below 20%, is among the claims he has used least, while AI governance claims are among those he has used most. The turnaround is hard, specific, unusual and defensible. The AI claims are increasingly generic.
- **AI is the loudest demand signal but not the screening one.** AI appears in 91% of position descriptions with the most raw mentions, yet stakeholder influence appears in 100% and delivery execution in 95%. Employers are excited about AI and screen on delivery credibility.

**The design consequence: the site must not be AI-first.** If the homepage leads with agentic engineering, he looks like precisely the thing `scope.md` §2 forbids. Lead with what he led and what it measurably produced. Let AI-native engineering be the sharpest of several proof points, grounded in measured delivery outcomes rather than positioned as the headline.

### The capability taxonomy

Five capabilities, used as the site's organising spine, as the filter values, and as the tagging model for every piece of evidence:

1. **Cloud and Platform Transformation**
2. **Delivery and Quality Engineering**
3. **Engineering Organisation and People**
4. **Security and Governance**
5. **AI-Native and Agentic Engineering**

---

## V1 Scope

### Must have (blocks launch)

| # | Capability | Why it earns its place | Est. |
|---|---|---|---|
| M1 | **Home** | The 30-second skim. Positioning statement, scale markers (38-person function led through six people-managers, Digital Governance Board seat, **bug reopen rate above 100% to below 20%**, Secure Score 20% to 76%, regulated healthcare and payments), availability, and clear routes into depth. | 3h |
| M2 | **Experience and Engineering Leadership** | Four case studies in Context / Decisions / Actions / Outcome / Lessons form, covering capabilities 1 to 4. Selective, not a résumé transcription. AI-Native evidence arrives through SH3 or, if that slips, as a fifth case study. | 8h |
| M3 | **Projects and Technical Work** | Tier 1 at launch: the Career Application System and this website. Both public, inspectable, and near-zero content cost. | 3h |
| M4 | **Capability filter** | The one V1 interaction. Filters case studies and projects together from a shared typed data model, with filter state in the URL so a view is linkable. **Must render a defined empty state**, since capability 5 has no must-have evidence until SH3 lands. | 3h |
| M5 | **Contact and CV** | Direct route to email and LinkedIn, plus a downloadable CV. Ungated in V1. | 1h |
| M6 | **Production deployment** | Vercel, custom domain, GitHub, CI running lint, type check, tests and production build. | 4h |
| M7 | **Engineering quality baseline** | TypeScript throughout, responsive across desktop, tablet and mobile, semantic HTML, accessibility, basic SEO with Open Graph, Lighthouse 90+ on all four categories. Requirements, not post-release additions. | 4h |
| M8 | **Launch integration** | The site linked from LinkedIn, both master résumés, and the application form pack. The site only works if it sits in the path recruiters already walk. | 0.5h |
| M9 | **Analytics and operational visibility** | Vercel Analytics. Satisfies `scope.md` §7, and without it SC4 and SC8 are unverifiable while SC3 and SC7 fall back to anecdote. One configuration line, no vendor relationship, no cookies, no consent banner. | 0.5h |
| | **Typed content model** | Cross-cutting. One capability-tagged schema serving M1, M2, M3 and M4. | 3h |

**Total: roughly 30 hours against a 30-hour budget.** That is zero contingency, and John should treat it as a finding rather than a plan. Any slip comes out of the Should-have tier, never out of M7, because a site that ships broken on mobile or fails accessibility damages the positioning more than a missing section does.

**Pre-agreed descope order, if the build runs long.** Decide this now, not in week two.

1. **Defer the Organisation and People case study** (M2 drops to three studies, saves ~2h). It is the most expensive of the four because it needs a genuine point of view rather than compression, and therefore the most likely to overrun. Three complete case studies plus two public projects is already a credible site.
2. **Defer a tier-1 project** (M3 drops to the Career Application System alone, saves ~1.5h). The website-as-project write-up is the easier of the two to add post-launch, since it is being lived rather than recalled.
3. **Accept a third week.** Better than shipping half-finished, but it must be a decision rather than a discovery.

**Never descope M7.** A site that breaks on mobile or fails accessibility damages the positioning more than any missing section does.

### Should have (fast-follow, does not block launch)

| # | Capability | Note |
|---|---|---|
| SH1 | **Projects tier 2** | The governed retrieval layer (story SB-S18) and the hands-on platform migration work. Both selected by Shahrouz. Both need an IP-clearance and anonymising pass only he can perform, which is why they are not launch-blocking. |
| SH2 | **Sign in with Google** | Demoted from must-have by agreement. Full OAuth/OIDC flow, session, signed-in indicator, sign-out, and one small authenticated-only capability. Recommended: the **full CV download and direct contact reveal**, with everything carrying positioning staying public. A recruiter who never signs in must lose nothing. |
| SH3 | **AI and Agentic Engineering section** | Specification-driven development, governed agentic workflows, human accountability boundaries, and the DORA-informed measurement framework. **Deviation from `scope.md` §6**, which lists this as a V1 functional area. Demoted deliberately: the capability-5 evidence can ride inside a case study under M2 if capacity is short, and the AI-first risk (R3) argues against giving it a dedicated headline route in V1. |

### Explicitly cut from V1

- **Writing / Engineering Notes.** Cut by decision. A notes section with zero or one post signals an abandoned side project and damages credibility more than its absence. Revisit once two or three posts exist.
- Everything in `docs/scope.md` §14: custom CMS, admin portal, complex database, general user accounts, comments or social features, contact-management system, AI chatbot or RAG assistant, multi-service architecture, elaborate animation frameworks, blogging platform, complex dashboards.

---

## Content Plan

The critical insight: this is a **selection, compression and clearance** exercise, not an authoring one. The source material is abundant and current. Story references are to `docs/story-bank.md`.

| Area | Source | New writing required |
|---|---|---|
| Home | Résumé V1 summary, `personal-facts.md` | Low. Compression only. |
| Case study: Delivery and Quality | Story SB-S4 (offshore turnaround) | Low. Strong numbers, already structured. |
| Case study: Security and Governance | Story SB-S11 (Secure Score 20% to 76%) | Low. |
| Case study: Cloud and Platform | Story SB-S1 (Azure modernisation), résumé V1 | Low. |
| Case study: Organisation and People | Stories SB-S5, SB-S12, SB-S20 | Medium. Needs a point of view, not an achievement list. |
| Project: Career Application System | Public repository and its C4 docs | Very low. Already written and shared. |
| Project: This website | Live build | Very low. Written as it is built. |
| Project: Retrieval layer (SH1) | Story SB-S18 | High. Needs generalising and original diagrams. |
| Project: Platform migration (SH1) | Résumé V1, story SB-S8 | Medium. Needs anonymising. |
| CV download | Master résumés, already rendered | None. |

**Confidentiality and accuracy rules are in `addendum.md` §3 and are binding on all website copy.** Do not restate them here; that section is the single source of truth.

---

## Success Criteria

| # | Criterion | Measure | Owner |
|---|---|---|---|
| SC1 | The site is live and shareable | Custom domain resolving, deployed from CI | Shahrouz |
| SC2 | It is in the recruiter's path | Linked from LinkedIn, both master résumés, and the application form pack | Shahrouz, at launch |
| SC3 | The skim works | Three recruiters or peers can state his level, scale and availability after 30 seconds on Home, unprompted | Shahrouz, within 2 weeks of launch |
| SC4 | Visitors reach evidence | 40% or more of sessions reach a case study or project page | Review at 8 weeks |
| SC5 | The repository survives inspection | Checklist, not a feeling: README explains the project, an architecture document exists, CI is green on main, no TODO or commented-out blocks, no secrets in history | Before launch |
| SC6 | Engineering baseline holds | Lighthouse 90+ on performance, accessibility, best practices and SEO, mobile and desktop | CI or manual, before launch |
| SC7 | It converts | At least two inbound conversations reference the site within eight weeks of launch | Review at 8 weeks |
| SC8 | It is measurable at all | Vercel Analytics live from launch (M9) | Before launch |

---

## Constraints, Assumptions and Risks

### Constraints

- **Roughly 30 focused hours for V1.** Fifteen hours a week, two weeks.
- Next.js, React, TypeScript, Node, deployed to Vercel, source on GitHub.
- No separate backend, database or service unless a V1 feature genuinely cannot be met without one. Nothing in the must-have scope requires one.
- Architecture proportionate to a personal website. No technology introduced to make the architecture look sophisticated. Dependencies added deliberately.
- Shahrouz remains accountable for requirements, architecture, significant decisions, acceptance criteria and review, and must be able to explain the implementation in an interview.

### Assumptions

- `[ASSUMPTION]` All V1 content renders from typed local data (TypeScript modules or MDX) with no CMS and no database.
- **Decided:** the domain is `shahrouzmohaghegh.com`, registered by Shahrouz and pointed at Vercel on day one. Full-name .com chosen over `.dev` and `.io`, which signal developer and startup respectively and work against a leadership-first positioning.
- `[ASSUMPTION]` The CV ships as a static PDF asset, with no on-demand generation.
- `[ASSUMPTION]` Design is restrained and typographic rather than bespoke, since no designer is engaged and a weak visual execution damages credibility more than a plain one does.

### Risks

| # | Risk | Impact | Mitigation |
|---|---|---|---|
| R1 | **The two tier-2 projects need an IP-clearance pass only Shahrouz can do**, and it is unbudgeted judgement work | Slips launch if treated as blocking | Keep them in SH1. Launch on the two public projects. |
| R2 | **Scope creep through the learning objective.** Every interesting Next.js feature is a candidate | Directly threatens the 30 hours | No feature justified by learning alone. John should reject on this basis explicitly. |
| R3 | **AI-first framing undermines the positioning** | Makes him look like the thing §2 forbids | Homepage leads with leadership and measured delivery outcomes. AI is a proof point, never the headline. |
| R4 | **The must-have set consumes the entire budget with zero contingency** | Anything unplanned pushes past two weeks | Sequence for an early production deploy. Descope from Should-have, never from M7. |
| R5 | **An unfinished section is worse than an absent one.** This is why Notes was cut | Credibility damage | Every V1 area ships complete or does not ship. Applies to any late descope. |
| R6 | **Design quality.** He is not a designer, and a weak-looking site actively harms a senior leadership positioning | Credibility damage | Restrained typographic design, strong content hierarchy, generous whitespace. Consider a short Sally (UX) pass before build. |
| R7 | **The site becomes a maintenance obligation** | Diverts time from higher-priority work | Static by construction. No comments, no accounts, no moderation, no content pipeline. |
| R8 | **Auth, if pulled back into V1, consumes hours with zero recruiter value** | Delays launch | Stays SH2. Build after the first production deploy. |

---

## Handoff to John

What the PRD must resolve that this brief deliberately leaves open:

1. **Information architecture and routing**, including whether the AI section is its own route (SH3) or folds into a case study.
2. **The typed content model.** One shared, capability-tagged schema serving Home, case studies, projects and the filter. The single most important technical decision in V1, because every other feature reads from it.
3. **Filter behaviour specifics:** single versus multi-select, the empty state for capability 5, URL parameter shape, and accessible keyboard and screen-reader behaviour.
4. **Case study page structure**, and how much detail sits on a card versus a detail page.
5. **Testing scope proportionate to 30 hours.** Recommended floor: unit tests on the filter logic and content model, one end-to-end test covering the skim journey, plus lint, type check and build in CI.
6. **Acceptance criteria per story**, with the launch-blocking set separated cleanly from the fast-follow set, so V1 can go live the moment the must-haves pass.
7. **Epic sequencing** that reaches a production deploy within the first few hours of build, rather than deploying once at the end.

**Open question for Shahrouz. This should be settled before the PRD, because the whole scope rationale is anchored to it.**

**Is the two-week target a real gate or a direction?** Every cut in this brief is justified by a 30-hour budget. If the deadline is soft, the Should-haves should be reconsidered and the scope re-cut accordingly.

*Settled since drafting:* analytics is promoted to must-have M9; the domain is `shahrouzmohaghegh.com`.


### `addendum.md` contents, and who needs which section

| Section | Owner |
|---|---|
| §1 Options considered and rejected (auth, interaction, notes) | John, so rejected paths are not relitigated |
| §2 Content source map, per item, with story IDs | Shahrouz, when writing |
| §3 **Confidentiality and accuracy rules. Binding.** | Everyone who writes a word of site copy |
| §4 **Technical constraints** | Winston (architecture) |
| §5 Post-V1 backlog, ordered by expected value | John, for roadmap framing |
| §6 The analytics decision and its consequences | Shahrouz |
