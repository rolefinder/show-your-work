# Site → OSS gap list

What the private dogfood site (harrison-site) has that recruit-me should absorb
later vs keep site-only. Derived from `EXTRACTION_ANALYSIS.md` Phase 3.

## Absorb next (OSS product)

| Feature | Notes |
|---------|-------|
| Architecture-kit figures | Single **core** package (do not ship a hand-fork design-system) |
| Posts in Fit corpus (config flag) | Site scores projects only; OSS already includes blog |
| GitHub secret scanning + push protection | Local `secrets:check` done; org toggle before public flip |
| Richer graph UX (layer toggles, compact lens) | Engine + `/graph` + `opts.forces` landed; lens polish later |

## Landed this slice

| Feature | Where |
|---------|-------|
| Search palette + token grammar | `src/search/*` — `{{work:}}` / `{{blog:}}` (+ `{{post:}}` alias); Ctrl/⌘K |
| Emit → generated module | `packages/content` → `src/generated/content.ts` (not splice-only) |
| Knowledge graph engine (CSP-safe IIFE) | `graph/*` → `assets/graph-engine.js`; typed `opts.forces` |
| `buildKnowledgeGraph` | `src/graph/buildKnowledgeGraph.ts` |
| Skill-bank UX + `?skill=` filter | `src/skills/SkillBank.tsx` + `content/config/skills.yaml` |
| Secret pattern scan in CI | `scripts/check-secrets.py` via `npm test` |
| Dogfood path docs | `docs/architecture/DOGFOOD_PATH.md` |

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
| Local secret pattern scan | `scripts/check-secrets.py` (wired into `npm test`) |
| GitHub secret scanning / public flip | **Owner** — enable before making the repo public |
| Graph package multi-instance `opts.forces` | **Done** — `graph/forces.mjs` + smoke |

## Explicit non-goals (still)

- Vendoring recruit-me back into the dogfood site in the same pass (docs only: `DOGFOOD_PATH.md`)
- LinkedIn scrapers / unofficial APIs
- Widening CSP for third-party model CDNs
- Agent flipping the GitHub repo from private → public
