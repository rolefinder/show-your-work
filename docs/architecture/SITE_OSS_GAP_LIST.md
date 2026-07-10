# Site → OSS gap list

What the private dogfood site (harrison-site) has that recruit-me should absorb
later vs keep site-only. Derived from `EXTRACTION_ANALYSIS.md` Phase 3.

## Absorb next (OSS product)

| Feature | Notes |
|---------|-------|
| Knowledge graph engine (CSP-safe IIFE) | After split + typed `opts.forces`; no `window.HHPG_*` API |
| `buildKnowledgeGraph` / highlight BFS | Package **graph**; Fit highlight glue in starter |
| Skill-bank UX + `?skill=` filter | Category map from tenant config, not a hardcoded vocabulary |
| Search palette / token grammar | `{{work:}}` / `{{post:}}` patterns |
| Architecture-kit figures | Single **core** package (do not ship a hand-fork design-system) |
| Posts in Fit corpus (config flag) | Site scores projects only; OSS already includes blog |
| Emit → generated module (not splice-only) | Content seam improvement |
| Secret scanning / public-flip checklist | Dependabot already on; add scanning before marketing flip |

## Keep site-only (never copy)

| Area | Why |
|------|-----|
| Real portfolio YAML / POSTS / FOCUS / hero | PII + employer topology |
| Identity (origin, email, LinkedIn, JSON-LD, llms.txt) | Personal |
| Publication-safety banlists with employer codenames | Mechanism OK; Harrison’s list is not demo data |
| design-sync project IDs / HH package names | Leak surface |
| `app/orchestrator`, agent-cicd, BugBot playbooks | Org tooling, not product |
| `/writing` route name | OSS uses `/blog`; site may keep `/writing` |

## Security baseline (this repo)

| Control | Status |
|---------|--------|
| Dependabot (npm + Actions) | Present (`.github/dependabot.yml`) |
| CI `npm run test` | Present (`.github/workflows/ci.yml`) |
| Strict CSP `_headers` | Present — no third-party model CDNs |
| `wrangler.example.toml` placeholders only | Present — no prod account IDs |
| Fictional corpus gate | `scripts/check-fictional-corpus.py` (wired into `npm test`) |
| Cite-or-missing Fit contract | Enforced in `matchFit` + fit-smoke |
| Secret scanning / public flip | **Gap** — before making the repo public |
| Graph package multi-instance `opts.forces` | **Gap** — no graph code in OSS yet |

## Explicit non-goals (still)

- Vendoring recruit-me back into the dogfood site in the same pass
- LinkedIn scrapers / unofficial APIs
- Widening CSP for third-party model CDNs
