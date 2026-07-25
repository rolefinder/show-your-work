# recruit-me extraction analysis — harrison-site reference

**Phase:** 1 (comprehensive code analysis)  
**Repo:** `harrison-site` @ `origin/main` (`0dc6be5`)  
**Diff baseline (thermo-nuclear):** `4f89965` (pre-#79) → `0dc6be5` (PRs #79–#85)  
**Methods:** pstack `/how` critique (product / fit / graph / content / CSP / SSOT) + thermo-nuclear review + thermo-nuclear code-quality review  
**Constraint:** read-only on production site code; this file is the only write artifact

---

## Executive verdict

harrison-site is a **working dogfood instance**, not a package. The reusable ideas (YAML emit, CSP-safe graph IIFE, client Fit heuristics, skill bank, architecture-kit figures) are real and high quality. They are **welded into one ~3.7k-line `app.jsx`** that conflates library, schema, template, and Harrison’s corpus.

**Do not** turn the site into the public template. **Copy patterns** into `recruit-me` with clean module cuts, fictional Avery Quill demo content, and a structured cite-or-missing Fit contract (site Fit is ranked substring scoring only).

Wave #79–#85 introduced **no new XSS/CSP/secret bugs**. Nuclear findings that matter for OSS are almost all **coupling / packaging / do-not-copy**, plus one maintainability blocker: `graph/portfolio-graph-engine.mjs` crossed 1k lines (483 → 1,099) this wave.

---

## 1. How the reference system works (pstack explain)

### Overview

A static SPA (`app.jsx` → Babel → `dist/app.js`) ships under Cloudflare Pages with a strict CSP (`script-src 'self'`, no eval, no CDN). Project content is authored as `content/projects/*.yaml` and emitted into `app.jsx`’s `PROJECTS` block (ADR 006). Posts remain hand-authored in `app.jsx` (ADR 008). A self-hosted WebGL knowledge graph (ADR 007) renders from client-built `{nodes, edges}`. Fit-check and skill-bank are client-only heuristics in the same file.

### Key concepts

| Concept | What it is |
|---------|------------|
| **Authoring SSOT (projects)** | `content/projects/<slug>.yaml` + `emit-project-data.py` |
| **Runtime SSOT** | Emitted/hand `app.jsx` text — validators and SEO still parse this file |
| **Search graph** | `buildSearchGraph()` — `work:` IDs, undirected adjacency, text index |
| **Knowledge graph** | `buildKnowledgeGraph()` — `proj:` IDs, typed layers `related` / `skills` / `writing` |
| **Graph engine** | `portfolio-graph-engine.mjs` → esbuild IIFE → `assets/graph-engine.js` → `window.HHPortfolioGraph` |
| **Fit** | `parseFitQuery` + `runFitQuery` — scores `PROJECTS` only; highlights KG neighborhood |
| **Skill bank** | Separate taxonomy UI (`SKILL_CATEGORY_*`); not used by Fit scoring |
| **design-system/** | Typed **copy** of primitives + architecture kit for Claude Design (ADR 009); not imported by live site |

### How Fit works today

1. User opens Cmd+K or types into Knowledge Lens; `?fit=` deep-links.
2. `isFitQuery` detects `?` / `fit:` prefixes or natural-language patterns including **“harrison”**.
3. `parseFitQuery` strips `FIT_STOP` (includes `harrison`) and expands `FIT_SYNONYMS`.
4. `runFitQuery` builds a corpus per project (`name`, `full`, `summary`, body tokens, `role`, `skills`, architecture text) and scores: skill +14, corpus +6, name +8; drop if score &lt; 6.
5. Verdict `strong` / `partial` / `thin` from evidence count + top score; summary is templated English.
6. Graph highlight seeds matched skills + top projects, then `pgBuildHighlightSet(..., hops: 1)`.

**Not implemented:** per-requirement cite-or-missing matrix, missing-term reporting, POSTS as evidence, graph edge confidence in scoring, JD structured parse.

### Dual graph

| | Search | Knowledge |
|--|--------|-----------|
| Project ID | `work:{slug}` | `proj:{slug}` |
| Edges | undirected `Map` | `{source,target,relation,confidence,layer}` |
| Consumer | `runSearch` | `PortfolioGraph` / lens / `/graph` |
| Validation | weak | dangling-edge throw via `pgSafeBuildGraph` |

Token grammar emits `work:`; knowledge builder translates to `proj:`. Fit bridges both: scores search-style corpora, highlights knowledge edges.

### Content emit (ADR 006)

```
content/projects/*.yaml
  → emit-project-data.py (schema, visible:false filter, soft-strip hidden tokens)
  → splice PROJECTS into app.jsx
  → sync-ui-kit-data.py
  → build-site.mjs (+ graph vendor) → dist/
  → validate-app-data.py + check-publication-safety.py
```

Hidden projects: soft-degrade tokens in visible YAML; **hard-block** if hand-authored `POSTS` still reference them.

### CSP packaging (ADR 007)

`_headers` CSP forbids CDN scripts. `build-graph-vendor.mjs` bundles Sigma + Graphology + FA2 into same-origin `assets/graph-engine.js`. Live site never imports those libs from `app.jsx`.

---

## 2. Critique verdict (pstack lead judgment)

### Act on (blocks clean OSS extract)

1. **Product boundary conflation** — `app.jsx` is library + schema + template + tenant content. recruit-me must ship packages, not a 3.7k monolith.
2. **Fit is not cite-or-missing** — ranked project list ≠ evidence brief. Keep recruit-me’s structured contract; absorb site heuristics as optional config.
3. **Harrison literals in Fit/skill/tenant** — `FIT_STOP`, `isFitQuery`, placeholders, `SITE_ORIGIN`, contact, skill taxonomy, graph page labels.
4. **Dual ID scheme without a package API** — `work:` vs `proj:` must be documented or unified in OSS.
5. **`HHPG_FORCES` window global** — not multi-instance-safe; must become `opts.forces` before publishing `graph`.
6. **design-system fork (ADR 009)** — two sources of truth for `core`; OSS must have one typed package.
7. **Engine crossed 1k lines this wave** — split before shipping as a package.

### Consider

- Emit `PROJECTS` to a generated module instead of splicing into UI source (content seam).
- Include posts in Fit corpus (site does not).
- Unify search + knowledge builders behind one graph model + adapters.
- `site.json` / tenant config for contact, routes, synonyms, skill categories (deferred on site).
- POSTS YAML SSOT (deferred ADR 006).

### Noted

- `!opts.compact` engine path appears unused (all mounts pass `compact`).
- `check-dist-smoke.py` hardcodes hidden slug list.
- `/graphify` alias → work view.
- Synonym replacement drops original token (not augmentation).

### Dismissed (for OSS design)

- “Rewrite site to import design-system tomorrow” — site CSP/precompile constraints are intentional; dogfood later, don’t block recruit-me v0.
- Wave #79–#85 security regressions — none found at high conviction.

---

## 3. Reusable vs site-specific inventory

### Reusable (copy patterns / extract)

| Area | Artifacts |
|------|-----------|
| **Content pipeline** | YAML schema, `emit-project-data.py` pattern, `visible` + reference integrity, validate + publication-safety gates, allowlist `build-site.mjs` |
| **Graph engine** | `portfolio-graph-engine.mjs` (after split + typed opts), `pg-*` CSS, esbuild IIFE vendor recipe, ADR 007 CSP story |
| **Graph data shaping** | `buildKnowledgeGraph` / highlight BFS / layer model (as package, not app.jsx) |
| **Search** | `buildSearchGraph` / `runSearch` / token grammar `{{work:}}` `{{post:}}` / `richText` |
| **Fit mechanism** | stop/synonym/score/verdict *shape* — as config-driven matcher, not literals |
| **UI primitives** | Eyebrow/Btn/Card/Tag/SectionHead, architecture kit (flow/hub/stack figures), ADR 008 body polymorphism |
| **Skill bank UX** | category grouping + Work `?skill=` filter pattern |
| **SPA shell** | history routing, SearchPalette, ContextGraphLens chrome, error boundary + WebGL teardown |
| **Security posture** | strict CSP `_headers`, allowlist deploy, no `dangerouslySetInnerHTML` for Fit/search (escapeRe + React nodes) |
| **design-system idea** | typed primitives for design sync — but **one** source, not a hand fork |

### Site-specific (never ship in OSS)

| Area | Examples |
|------|----------|
| **All real portfolio YAML** | `content/projects/*`, especially entries describing professional work and the vendor stacks behind them |
| **POSTS / FOCUS / hero** | Harrison essays, surfing hero assets, personal bio |
| **Identity** | `SITE_ORIGIN`, emails, LinkedIn/GitHub, Person JSON-LD, `llms.txt` |
| **Fit/skill literals** | `harrison` in stop/NL patterns, Harrison synonym map, `SKILL_CATEGORY_MAP` |
| **Publication-safety banlists** | Employer codenames, handle fragments, internal leak patterns — keep the *mechanism*, never one maintainer's list as demo data |
| **design-handoff extracted dump** | full `app.jsx` copies, personal photos, brand notes |
| **`.design-sync/config.json`** | Claude Design `projectId`, `HHDesignSystem`, `harrison-site-design-system` |
| **Org/agent CI** | `app/orchestrator`, agent-cicd wiring, BugBot SDK — not recruit-me product |

---

## 4. Must-fix before extract

| # | Issue | Why |
|---|--------|-----|
| 1 | Replace all real content with Avery Quill (or equivalent) fictional corpus | Employer topology + PII/portfolio identity must not go public |
| 2 | Parameterize Fit: `displayName`, stop words, synonyms, NL patterns, scoring, verdict copy | Hardcoded Harrison identity |
| 3 | Parameterize tenant: origin, contact, routes (`/work` `/blog`), skill taxonomy, theme tokens | Scattered constants today |
| 4 | Thread `forces` through `create()`/`update()`; drop mutable `window.HHPG_FORCES` as API | Package multi-instance safety |
| 5 | Split graph engine under ~1k along model / forces / orchestration | 1k-rule; publishable module tree |
| 6 | Decide Fit package edge: `fit-core` (pure scoring) vs Fit→graph highlight in starter | `runFitQuery` forward-depends on `buildKnowledgeGraph` |
| 7 | Single `core` package; do not ship ADR 009 hand-fork as the public API | Drift / dual maintenance |
| 8 | Document or collapse `work:` vs `proj:` ID prefixes | Newcomers will wire the wrong graph |
| 9 | Implement cite-or-missing evidence brief (aligned requires citation; missing terms explicit) | Product lock for recruit-me; site Fit is insufficient |
| 10 | Scrub design-sync IDs, personal assets, extracted handoff trees from any scaffold tarball | Accidental leak surface |

---

## 5. Recommended OSS package cut

```
recruit-me/
  packages/
    core/          # primitives, architecture-kit, tokens, richText helpers
    content/       # YAML schema, emit, validate, fictional demo corpus
    graph/         # engine + buildKnowledgeGraph adapter + typed PortfolioGraphOptions
    fit/           # parse + cite-or-missing matcher (+ optional synonym/weight config)
                   #   fit-core MUST NOT import React; highlight glue stays in starter
    starter/       # Vite/TS SPA template: routes /work /blog, CSP _headers, Avery Quill
  workers/         # optional later: Fit worker (same matcher, off-main-thread)
```

### Ownership rules

| Package | Owns | Must not own |
|---------|------|--------------|
| **core** | UI primitives, figure kit, shared hooks | PROJECTS/POSTS, Fit scoring, Sigma |
| **content** | YAML ↔ JS emit, visibility policy, demo data | React pages, graph rendering |
| **graph** | IIFE/vendor recipe, layout, Sigma, KG builder from content DTOs | Tenant copy, Fit verdicts |
| **fit** | Query parse, evidence matrix, deterministic match | Window globals, page chrome |
| **starter** | App shell, routing, CSP headers, wiring | Hardcoded person strings (read from config) |
| **Fit worker** | Same pure matcher as `fit` | DOM / graph highlight |

### Site → package mapping (code judo)

1. Lift generated `PROJECTS` out of UI file → **content** (highest leverage; ~⅓ of `app.jsx`).
2. Move `buildKnowledgeGraph` + `pgBuildHighlightSet` → **graph**.
3. Move `FIT_*` / `parseFitQuery` / scoring → **fit**; leave lens banner in **starter**.
4. Generate or import **core** once; retire hand-maintained design-system fork for OSS.
5. Split engine file before publish.

---

## 6. Explicit do-not-copy list

- Any `content/projects/*.yaml` from the private site, especially entries describing professional work
- `POSTS`, `FOCUS`, hero surfing images, personal OG/JSON-LD
- `FIT_STOP` / `isFitQuery` / placeholders containing `harrison`
- `SKILL_CATEGORY_MAP` as-is (Harrison’s vocabulary)
- `CONTACT_EMAIL`, `SITE_ORIGIN`, LinkedIn, GitHub personal URLs
- `docs/design-handoff/extracted/**`, personal photos, full app.jsx dumps
- `.design-sync/config.json` projectId / HH package names
- Publication-safety patterns that encode employer-internal codenames (as demo data — the mechanism ships, the list does not)
- `app/orchestrator`, agent-cicd, BugBot playbooks
- Real `llms.txt` / sitemap identity
- Assumption that `/writing` is the OSS route (OSS uses `/blog`; site may keep `/writing`)

---

## 7. High-conviction nuclear findings (affect OSS design)

### Security / correctness (wave #79–#85)

| Severity | Finding | OSS implication |
|----------|---------|-----------------|
| — | **No new XSS/CSP/secret issues** in wave | Safe to copy *mechanisms* (escapeRe, React nodes, self-hosted graph, allowlist build) |
| Low–Med | `window.HHPG_FORCES` mutable transport | Must be typed `opts` before package publish |
| Low | O(n²) collision on every drag mousemove | Fine for ~25 projects; guard/rAF for large demo graphs |
| Pre-existing (flag) | Employer stack detail in a professional-work entry | **Wrong to republish** in a public template |

### Maintainability / structure

| Severity | Finding | OSS implication |
|----------|---------|-----------------|
| **Blocker** | `portfolio-graph-engine.mjs` 483 → **1,099** lines this wave | Split model / forces / orchestration before OSS `graph` |
| **Blocker** | `design-system/` hand-fork of core (ADR 009) | One typed `core`; don’t ship dual sources |
| High | `app.jsx` ~3,747 lines; ~1,235 generated `PROJECTS` inlined | Content package seam first |
| High | Fit forward-depends on KG builder | Declare Fit→graph edge or split `fit-core` |
| Med | `skillOf` copy-pasted 5×; GraphPage duplicates ProjectDetail/Post | Canonical content helpers + `NodeDetail` |
| Med | `fitQuery` prop-drilled through all pages | FitContext in starter |
| Med | Untyped `opts` bag on engine | `PortfolioGraphOptions` / `Handle` as public contract |

### Positive confirmations (keep)

- Fit/search escape regex + React rendering (no `innerHTML`)
- Graph error boundary + `WEBGL_lose_context` on destroy
- `visible: false` + sitemap smoke for hidden slugs
- `sync-ui-kit-data.py` callable-repl fix (backslash-safe)
- Emit soft-strip prevents dangling-edge client crashes

---

## 8. Actionable hardening list — recruit-me Phase 3

Prioritized for the OSS scaffold (after Phase 2 lands runnable v0.2):

### P0 — correctness & safety of the public product

1. **Cite-or-missing Fit contract** with fixtures: aligned JD → citations; negative/missing terms; no silent “strong” without evidence.
2. **Tenant config schema** (`profile.json` / `site.yaml`): displayName, routes, contact, stopWords, synonyms, skillCategories, scoring weights, theme.
3. **Fictional-only corpus gate** in CI: fail if real domain emails / known employer stack fingerprints appear.
4. **CSP starter `_headers`** matching site posture; graph via self-hosted IIFE only; no model CDNs in v1.
5. **Typed graph API**: `create(container, opts)` including `forces`; no required `window.HHPG_*` for consumers.

### P1 — package boundaries

6. Split graph engine modules; keep IIFE as *delivery*, not *API*.
7. Extract `fit-core` pure functions + optional worker; starter owns highlight UI.
8. Content emit package with Avery Quill YAML + `visible` policy tests.
9. Single `core` package; design-sync consumes it (or generate from it).
10. Unify or document ID prefixes (`work` vs `proj`) in SCHEMA.md.

### P2 — quality & dogfood prep

11. Tests: emit validation, dangling edges, Fit fixtures, hidden-project token strip.
12. Dependabot + secret scanning before any “public flip” marketing.
13. Collapse GraphPage / detail duplication pattern in starter.
14. Optional: posts in Fit corpus behind config flag.
15. Document site→OSS gap list (skill bank polish, orbit physics, home modules) as absorb-later, not v1 blockers.

### Explicit non-goals for Phase 3

- Merging harrison-site backlog docs PRs into site `main`
- Vendoring recruit-me back into harrison-site in the same pass
- LinkedIn scrapers / unofficial APIs
- Widening CSP for third-party model CDNs

---

## 9. Critique angles — one-line answers

| Angle | Verdict |
|-------|---------|
| **1. Product boundary** | Conflated in `app.jsx`; cut into core / content / graph / fit / starter |
| **2. Evidence / Fit** | Heuristic ranked list; OSS needs cite-or-missing + config-driven NLP |
| **3. Dual graph** | Intentional `work:`/`proj:` split; extract builders with documented translation |
| **4. Tenant config** | Missing; literals scattered — first-class config in OSS |
| **5. CSP packaging** | ADR 007 IIFE pattern is the right OSS default |
| **6. Content SSOT** | ADR 006 projects-only; extend pattern to posts optionally; don’t splice into UI forever |

---

## 10. Sources

- Explorers: Fit/evidence, dual graph/CSP, content SSOT + product boundary
- Thermo-nuclear review (bugs/security/leaks) on `4f89965..0dc6be5`
- Thermo-nuclear code-quality review (1k rule, package judo) on same range
- ADRs: 002 publication-safety, 006 modular projects, 007 knowledge graph, 008 post body, 009 design-system
- Primary files: `app.jsx`, `graph/portfolio-graph-engine.mjs`, `scripts/org/emit-project-data.py`, `scripts/build-site.mjs`, `_headers`

---

*End of Phase 1 synthesis. Next: Phase 2 land/rebuild recruit-me scaffold; Phase 3 apply this hardening list.*
