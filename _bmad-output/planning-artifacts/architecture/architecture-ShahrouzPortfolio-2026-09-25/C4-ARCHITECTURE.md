---
name: ShahrouzPortfolio
type: c4-architecture
derived-from: ARCHITECTURE-SPINE.md
status: final
created: '2026-10-07'
---

# C4 Architecture, ShahrouzPortfolio

Three levels, because only three earn their place. This is a six-route static
website with no backend, no database and no external service. The context and
container levels are therefore short by necessity, and the component level
carries the architecture.

Authority for every statement here is `ARCHITECTURE-SPINE.md`. Where this
document and the spine differ, the spine is correct.

---

## Level 1, Context

Governed by AD-17 (deployment and environments), AD-21 (the repository is a
deliverable), AD-1 (the Analytics exemption) and FR-30 and FR-31.

Three visitor types, taken from the PRD's user journeys. They are not roles in
the system: there are no accounts and no authentication. They differ only in
which route they enter on and how long they stay.

```mermaid
flowchart TB
  subgraph visitors["Visitors, no accounts, no authentication"]
    V1["Recruiter<br/>UJ-1, skims Home on a phone,<br/>decides in under a minute"]
    V2["Hiring executive<br/>UJ-2, reads one case study<br/>for judgement and outcomes"]
    V3["Technical interviewer<br/>UJ-3 and UJ-4, filters by capability,<br/>then leaves for the repository"]
  end

  SITE["ShahrouzPortfolio<br/>shahrouzmohaghegh.com<br/>Next.js App Router, static hosting"]

  V1 --> SITE
  V2 --> SITE
  V3 --> SITE

  SITE -->|"served by, HTTPS, apex and www"| VERCEL["Vercel<br/>hosting, CDN, instant rollback"]
  SITE -->|"page views, no cookies, no PII"| VA["Vercel Analytics"]
  SITE -->|"outbound link, UJ-3"| GHREPO["github.com/shahrouzmohaghegh/<br/>career-application-system<br/>public evidence repository"]
  SITE -->|"outbound link, contact route"| LI["LinkedIn profile"]

  GH["GitHub<br/>source of this site, public"] -->|"push on default branch<br/>triggers CI, then deploy"| VERCEL
  GH -->|"read by UJ-3 as evidence, AD-21"| V3
```

Two things in this diagram are load-bearing and easy to miss.

The GitHub repository appears twice for two different reasons. It is the build
input, and it is also a visitor-facing artifact: AD-21 makes the repository a
deliverable because UJ-3 is a Principal Engineer opening it, and because the
site's own PR-2 case study is about how it was built. A repository that looks
abandoned inverts UJ-3 into active damage, which is why FR-27's link integrity
check is launch-blocking.

Vercel Analytics is the only runtime dependency the browser reaches for, and it
exists under the single narrow exemption in AD-1: a third-party configuration
component that carries no site logic and renders no content.

---

## Level 2, Container

Governed by AD-4 (dynamic rendering on the listings), AD-5 (content format),
AD-9 (the crawl against a running server), AD-17 (the CI gate) and AD-20
(accessibility and performance gates).

There is essentially one container. Being honest about that is the point of
drawing this level at all.

```mermaid
flowchart TB
  subgraph prod["Production, Vercel"]
    APP["Next.js application<br/>App Router, React 19.2, Node 24<br/>4 static routes, 2 dynamic listings"]
  end

  subgraph build["Build time, GitHub Actions"]
    CONTENT["Content, compiled in<br/>content/*/index.ts typed metadata<br/>content/*/*.mdx prose"]
    CI["CI gate<br/>lint, tsc, Vitest, next build,<br/>next start plus crawl, axe,<br/>Lighthouse, token drift"]
  end

  CONTENT -->|"imported at build, AD-5"| APP
  CI -->|"gates deployment once a step exists, AD-17"| APP
  CI -->|"next start, then crawls every route<br/>and every filter combination, AD-9"| APP

  APP --- NOTE["No database. No API. No backend service.<br/>No environment variables in V1, AD-17."]
```

The two listing routes render per request, which is the one declared departure
at this level. Accepting `searchParams` makes a route ineligible for static
generation, and that is a binary switch rather than a cost proportional to use.
AD-4 accepts it because these routes fetch nothing and render local typed data,
so the server render is measured in microseconds. The rejected alternative,
sixteen statically generated pages behind an optional catch-all, would have been
genuinely static at the cost of a duplicate-content problem across sixteen
near-identical pages requiring canonical tags.

The CI gate deserves its box rather than a footnote. AD-9 puts the
confidentiality and link checks against a running production server, not against
source files and not against build output. Source scanning throws false
positives on the rule list itself, and build output does not contain the two
listings at all, because by decision they emit no HTML at build time. A check
that scans the wrong artifact gives the comfort of a guard without the
protection of one.

---

## Level 3, Component

Governed by AD-1 (the closed island register), AD-2 (the filter is not an
island), AD-3 (title generation), AD-6 (`EvidenceItem`), AD-8 (tokens),
AD-10 (dependency direction), AD-13 (`lib/evidence.ts` ownership),
AD-14 (`RevealOnScroll`), AD-19 (`SectionRail`), AD-22 (the decision table) and
AD-23 (per-route not found).

```mermaid
flowchart TB
  subgraph routes["app/, six routes, server-rendered"]
    RHOME["page.tsx<br/>/ static"]
    REXP["experience/page.tsx<br/>listing, dynamic"]
    REXPD["experience/[slug]/page.tsx<br/>static"]
    RPRJ["projects/page.tsx<br/>listing, dynamic"]
    RPRJD["projects/[slug]/page.tsx<br/>static"]
    RCON["contact/page.tsx<br/>static"]
    RNF["experience/[slug]/not-found.tsx<br/>projects/[slug]/not-found.tsx<br/>AD-23"]
    RMETA["sitemap.ts, robots.ts<br/>AD-16"]
  end

  subgraph comps["components/, server"]
    CARD["Card<br/>reads EvidenceItem only"]
    CHIPS["CapabilityChips<br/>next/link, no state, AD-2"]
    STATE["StateLine<br/>visible filter summary"]
    DIAG["Diagram and DecisionTable<br/>embedded in MDX, AD-22"]
    NFC["NotFound shared body"]
  end

  subgraph islands["components/islands/, client, register closed at two"]
    REVEAL["RevealOnScroll<br/>AD-14"]
    RAIL["SectionRail<br/>AD-19"]
  end

  EV["lib/evidence.ts<br/>EvidenceItem contract, AD-6<br/>param parse, normalise, serialise<br/>filter predicate, cross-route counts<br/>listing title and state line, AD-3<br/>sole owner, AD-13"]

  subgraph content["content/, build-time data"]
    CS["case-studies/index.ts + *.mdx"]
    PR["projects/index.ts + *.mdx"]
  end

  TOK["styles/tokens.css<br/>109 tokens, AD-8<br/>styles/reveal.css, global, AD-14"]

  subgraph scripts["scripts/, CI only"]
    SC1["check-content.mts<br/>FR-29 conditional rules, FR-27 links"]
    SC2["check-tokens.mts<br/>DESIGN.md to tokens.css parity"]
  end

  RHOME --> CARD
  REXP --> CHIPS
  REXP --> STATE
  REXP --> CARD
  RPRJ --> CHIPS
  RPRJ --> STATE
  RPRJ --> CARD
  REXPD --> DIAG
  RPRJD --> DIAG
  RNF --> NFC

  REXP --> EV
  RPRJ --> EV
  REXPD --> EV
  RPRJD --> EV
  RMETA --> EV
  CHIPS --> EV
  STATE --> EV
  CARD --> EV

  RHOME --> REVEAL
  REXPD --> RAIL
  RPRJD --> RAIL

  EV --> CS
  EV --> PR

  CARD --> TOK
  CHIPS --> TOK
  DIAG --> TOK
  REVEAL --> TOK
  RAIL --> TOK

  SC1 -.->|"crawls the running site"| routes
  SC2 -.-> TOK

  CS -.->|never| comps
  REVEAL -.->|never| content
  RAIL -.->|never| content
```

The two dotted `never` edges are AD-10 stated as prohibitions rather than as
structure. Content knows nothing about components, and an island imports no
content and no other island. Both exist to stop a specific drift: content
reaching for presentation concerns, and an island quietly becoming a general
client boundary that everything else routes through.

The single most important node is `lib/evidence.ts`. The adversarial review of
this spine found twenty-one ways two independently built stories could produce
incompatible code from the same document, and fifteen of them traced to one
root cause: a shared interface is not a shared implementation. Two stories can
both satisfy `EvidenceItem` and still write their own param parser, disagreeing
on casing, duplicates, an empty `?capability=` and unknown slugs, at which point
a selection fails to survive the cross-route link in FR-19 and UJ-4 breaks.
AD-13 answers that by naming one owner for the whole behaviour, parsing through
serialisation through counting through title generation, with the title and the
visible state line sharing one joiner so they can never disagree.

Note what is absent from the island layer. The capability filter is the most
interactive thing on the site and it is not a client component. It was
originally classified as interactive because a user interacts with it, which
does not follow: interaction does not imply client-side state. The URL is the
state, the chips are `next/link` elements rendered on the server, and both
listings ship no hydration at all.

---

## Where this document chose

Two places where the spine is internally inconsistent, resolved in favour of the
ADs because the ADs are the normative sections.

1. **Island count in the Structural Seed.** The seed annotates
   `components/islands/reveal-on-scroll.tsx` as "the only client component",
   which predates AD-19. AD-1 and AD-19 both state the register holds two.
   Diagrams here show two.
2. **Not-found location in the Structural Seed.** The seed lists a single
   `app/not-found.tsx` serving both dynamic routes. AD-23 replaces it with one
   per route, because one file cannot emit the two messages the contract
   requires. Diagrams here follow AD-23.
