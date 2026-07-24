# ADR 017: Prerendering, the editorial contract, and one-command setup

**Status:** Accepted
**Date:** 2026-07-24

## Context

ADR 016 made adoption a `content/` edit rather than a code change. That closed
the *configuration* gap but not the *capability* gap: a correctly-configured
recruit-me site still could not do what a full personal portfolio does.

Three things were missing, in descending order of how much they mattered to
the product's actual claim — "a recruiter finds your evidence":

1. **Nothing was crawlable.** ADR 014 §5 recorded this honestly: per-route
   title/description/canonical were set by the client, so any crawler or link
   unfurler that doesn't execute JS saw only the home shell. For a template
   whose entire purpose is discoverability, this was the load-bearing gap.
2. **Work pages had no structure.** `buildEvidencePack` flattened
   `title + summary + body + skills` into one blob, so a Fit citation was a
   160-character window cut out of the middle of a paragraph, and an "aligned"
   requirement frequently cited nothing but the bare tag `CI/CD`.
3. **Setup was an eight-step runbook.** "Use the plugin as directed" meant a
   human reading markdown and hand-editing five YAML files in the right order,
   with the `demo: false` flip and the `extraCaveats` clear as steps that are
   easy to skip and only bite after deploy.

## Decision

### Prerendering

1. **`scripts/lib/routes.ts` is the single route table**, built from the same
   generated content module that drives the client router. `sitemap.xml`,
   `known-paths.json`, the prerendered documents and the social cards all
   derive from it, so they cannot drift.
2. **`scripts/prerender-routes.ts`** snapshots every route with headless
   Chromium into `dist/<route>.html`, each with its own title, description,
   canonical, OG/Twitter tags, and JSON-LD (Person + WebSite + the
   route-appropriate WebPage/CollectionPage/ProfilePage/CreativeWork/
   BlogPosting, plus BreadcrumbList). This also closes ADR 014's deliberate
   JSON-LD omission — it was skipped because a fictional persona shouldn't
   claim an identity, but the graph is generated from `profile.yaml`, so a
   real adopter gets a real one.
3. **A 1200×630 social card per route**, drawn with the site's own theme
   colors and the system font stack — the template ships no webfont, so the
   card must not depend on one.
4. **`functions/_middleware.js` serves the route's own document**, falling
   back to the shell. Continuing to serve `index.html` for everything would
   have left every URL carrying the home page's metadata, discarding the
   entire benefit.
5. **Playwright is optional locally, required in CI.** A missing browser
   warns and produces an SPA-only `dist`; `PRERENDER_REQUIRED=1` (set in the
   CI workflow) turns that into a hard failure, so a deploy cannot silently
   ship without prerendered documents. `seo-smoke` enforces all-or-nothing
   coverage: once any route is prerendered, every indexable route must be.
6. **`build.mjs` wipes `dist/` first.** Route docs and cards are named after
   content slugs, so deleting a project used to leave its page and card
   behind, served for a path no longer in the sitemap.

### The editorial contract

7. **`content/work/*.yaml` gains optional `problem` / `outcome` / `evidence` /
   `decisions`**, rendered by `ProjectBrief`, which emits only the cells the
   YAML fills so a half-authored project degrades to a shorter brief rather
   than empty headings.
8. **`outcome` and `evidence` become `claims`** on the evidence doc — whole
   authored statements — and the retriever's quote preference is explicit and
   ordered: **claim > skill note > skill tag > text snippet**. It never forces
   a claim that doesn't actually match the requirement term.
9. **`skill_notes` (per work item) and `descriptions` (per site)** form the
   two halves of a skill tooltip, and the note is what Fit quotes instead of a
   bare tag. A CI/CD requirement now cites "Delivery runs through merge gates
   rather than trusting a green local build."
10. **`scripts/emit-evidence.py` is gated against drift.** It is a second
    implementation of `buildEvidencePack` — the browser builds its pack from
    the generated module, `/api/fit` fetches this JSON — and the two had
    already diverged. `fit-smoke` now compares them field by field.

### One-command setup

11. **`npm run init`** (`scripts/init-site.mjs`) does every step of the runbook
    in one pass: writes `site.yaml` and `profile.yaml`, replaces the demo
    persona's Fit stop words with the adopter's name tokens, clears
    `extraCaveats`, sets `demo: false`, and optionally swaps the demo corpus
    for starter files. It validates origin/email/accent before writing, has a
    `--dry-run`, and is scriptable via `--config me.json` — a scaffolder you
    cannot script is only half a tool. It writes to `content/` and the four
    `--rm-*` lines in `tokens/colors.css`; it never touches `src/`.

12. **Tests split into engine invariants and demo expectations.** Running
    `init` surfaced that `fit-smoke` asserted things about the *demo* corpus
    ("a CI/CD JD must cite Harbor Gate"), so a correctly-initialized adopter
    site could not pass `npm test` — the same trap the fictional-corpus gate
    had. Corpus-independent invariants (cite-or-missing, nonsense yields
    nothing aligned, caveats come from config, the two evidence packs agree)
    always run; demo expectations run only when `demo: true`.

## Verification

The whole adopter path was exercised end to end, not reasoned about: `init`
was run against a fresh identity, `npm test` passed green with prerendering,
and the built `dist/` was checked to carry that identity's titles, canonicals,
`llms.txt`, and accent color, with no demo chrome — then reverted.

## Consequences

- The build now needs a browser for its best output. That is a real new
  dependency; it degrades rather than breaks, and the degradation is loud.
- Prerender time scales with route count. At template scale (9 routes) it is
  seconds; a corpus in the hundreds would want a content-hash skip.
- `scripts/lib/` had to be un-ignored — the repo's Python-derived `.gitignore`
  has an unanchored `lib/` that was silently swallowing it.
- Adding a head tag means touching both `index.html` and `applyRouteHead`;
  the helper throws rather than no-ops when they drift, which is the intended
  trade.

## Still open

- The knowledge graph is its own page rather than an embedded lens on
  home/work.
- No infrastructure-as-code: the Pages project and domain are dashboard-set.
- No LinkedIn export parser (`packages/ingest/` drafts from resume text and
  GitHub for human review).
