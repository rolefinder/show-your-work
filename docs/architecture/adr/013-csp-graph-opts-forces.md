# ADR 013: CSP-safe graph package with typed `opts.forces`

**Status:** Accepted  
**Date:** 2026-07-10

## Context

The dogfood site ships a WebGL knowledge graph (decided separately on a sibling private project) as a
self-hosted esbuild IIFE. Its engine grew past 1k lines and reads layout
overrides from `window.HHPG_FORCES`, which is not multi-instance-safe and is a
blocker for publishing a reusable **graph** package.

## Decision

show-your-work ships a **split** engine under `graph/`:

| Module | Role |
|--------|------|
| `forces.mjs` | `resolveForces(opts)` — typed defaults + compact presets |
| `theme.mjs` | CSS color readback (`--pg-*`) |
| `layout.mjs` | Graphology model + ForceAtlas2 |
| `engine.mjs` | Sigma create/update/destroy |
| `index.mjs` | `window.SYWPortfolioGraph` |

Callers pass `opts.forces` / `update({ forces })`. The vendor bundle must not
reference `HHPG_FORCES`. Build: `scripts/build-graph-vendor.mjs` →
`assets/graph-engine.js`. Demo surface: `/graph`.

Knowledge-graph **data** is built in TypeScript (`src/graph/buildKnowledgeGraph.ts`)
from work/blog DTOs — engine stays free of tenant copy.

## Consequences

- Build-time deps: `graphology`, `graphology-layout-forceatlas2`, `sigma`
- Strict CSP unchanged (`script-src 'self'`)
- Site dogfood can adopt `resolveForces` without taking the whole OSS tree
  (see `DOGFOOD_PATH.md`)
