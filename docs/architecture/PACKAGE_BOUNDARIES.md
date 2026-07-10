# Package boundaries (target cut)

recruit-me ships as a **template monorepo-shaped tree** today (`src/`, `content/`,
`scripts/`). Full `packages/*` extraction is deferred; this doc locks ownership
so future splits stay honest.

## Target packages

| Package | Owns | Must not own |
|---------|------|--------------|
| **core** | UI primitives, tokens, richText helpers | PROJECTS/POSTS, Fit scoring, Sigma |
| **content** | YAML ↔ emit, visibility policy, demo corpus, fictional-corpus gate | React pages, graph rendering |
| **graph** | Engine + KG builder + typed `PortfolioGraphOptions` (`opts.forces`) | Tenant copy, Fit verdicts |
| **fit** | Query parse, cite-or-missing matcher, optional synonym/weight config | Window globals, page chrome |
| **starter** | App shell, `/work` `/blog` `/fit`, CSP `_headers`, wiring | Hardcoded person strings (read from config) |

## Current layout → package map

| Path today | Maps to |
|------------|---------|
| `src/fit/*` | **fit** (pure matcher; no React in `match`/`extract`/`evidence`/`config`) |
| `src/fit/FitPage.tsx` | **starter** (UI chrome; may stay colocated until package extract) |
| `src/app.tsx` | **starter** |
| `content/**` | **content** (Avery Quill demo only) |
| `content/config/fit.yaml` | **starter/tenant** → passed into **fit** as `FitMatchConfig` |
| `scripts/emit-*.py`, `check-fictional-corpus.py` | **content** tooling |
| `functions/api/fit.ts` | optional Fit worker / Pages Function (same matcher) |
| `packages/ingest/` | ingest helpers (not Fit core) |
| graph engine | **not shipped yet** — absorb from dogfood site later (see gap list) |

## ID prefixes (when graph lands)

Documented early to avoid the site’s dual-scheme footgun:

| Prefix | Graph | Use |
|--------|-------|-----|
| `work:{slug}` | search / evidence ids | Content + Fit evidence pack |
| `proj:{slug}` | knowledge graph | Visual KG nodes (translate from `work:`) |
| `blog:{slug}` | both | Writing / blog evidence |

Fit evidence ids today use `work:` / `blog:` / `about` — keep that contract in
**fit**; graph adapters translate to `proj:` if needed.

## Fit → graph edge

`fit-core` (**match** / **retrieveEvidence**) must not import React or a graph
engine. Highlight / lens glue stays in **starter** (or a thin adapter).

## Config surface

- Person names, contact, routes, skill taxonomy, synonym extras, skill weights →
  tenant YAML (`content/about/profile.yaml`, `content/config/fit.yaml`).
- Core defaults (`src/fit/config.ts`) are generic English stops + common tech
  synonyms only — **no** real-person stopwords.
