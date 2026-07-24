# ADR 016: The adopter-config boundary (identity is data, never code)

**Status:** Accepted
**Date:** 2026-07-24

## Context

The template's stated promise is that standing up your own site is an edit to
`content/`. Auditing the actual adopter path against that promise found the
promise was partly false, in ways that would only surface *after* someone
deployed:

1. **`src/fit/match.ts` hardcoded a demo caveat** appended to every brief:
   "Demo corpus is fictional (Avery Quill); replace with your own YAML before
   production use." An adopter who replaced `content/` and deployed would show
   that sentence to every recruiter who ran a JD, with nothing in the setup
   docs pointing at it. `src/fit/config.ts` even carried the comment "never
   hardcoded in fit-core" directly above the config type it should have used.
2. **`content/config/fit.yaml` was inert.** It is emitted to
   `dist/fit-config.json` and asserted by `fit-smoke`, but neither
   `FitPage.tsx` nor `functions/api/fit.ts` ever loaded it — both called
   `matchFit(jd, docs)` with no config. Every tenant knob (`extraStops`,
   `synonyms`, `skillWeights`, `weights`) applied only inside the test.
3. **`index.html` and `manifest.json` were hand-authored** with the demo
   persona in `<title>`, `description`, `og:title`, `og:description`,
   `name`, and `short_name` — six edits in two file formats, none mentioned in
   `skills/infra-pages/SKILL.md`.
4. **`src/app.tsx` hardcoded** a `— recruit-me demo` title suffix, a
   "recruit-me demo" home eyebrow, and a "Demo corpus · Avery Quill
   (fictional)" footer line.
5. **No contact affordance.** `profile.yaml` had `email` but nothing rendered
   it, and no field existed for a GitHub/LinkedIn link — a portfolio a
   recruiter cannot reply to.

The common shape: identity that should be data had leaked into code, and the
one config file that *was* data was not wired to anything.

## Decision

1. **`content/config/site.yaml` owns deployment identity** — `origin`,
   `title_suffix`, `description`, `short_name`, `theme_color`,
   `theme_color_dark`, and a `demo` flag. It is emitted as `SITE_CONFIG`
   alongside the existing `SITE_ORIGIN`.
2. **`scripts/emit-html.ts`** (new, between `bundle` and `emit:seo`) rewrites
   `dist/{index,404}.html` and `dist/manifest.json` from `SITE_CONFIG`. The
   source `index.html` becomes a template carrying visible `placeholder — set
   in content/config/site.yaml` values, so a drifted emitter is obvious rather
   than silent. The emitter throws if a tag it expects is missing, rather than
   no-op'ing.
3. **`demo` drives the demo chrome** — the home eyebrow and the footer
   disclaimer render only when it is true. Flipping it to `false` is the
   documented last step of adoption.
4. **Fit caveats move to `FitMatchConfig.extraCaveats`.** The engine exports
   `ENGINE_CAVEATS` — the two statements true of *any* corpus — and
   `resolveCaveats()` appends tenant ones. The demo disclaimer now lives in
   `content/config/fit.yaml`.
5. **Both Fit paths load the tenant config.** `FitPage` fetches
   `/fit-config.json` on mount (held in a ref; absent or malformed config
   falls back to engine defaults, which are a complete configuration on their
   own) and `functions/api/fit.ts` fetches it per request, so `/api/fit` and
   the offline browser matcher return identical briefs.
6. **`profile.yaml` gains `links`**, rendered with the email as one outlined
   contact strip on home and about.
7. **`scripts/check-adopter-config.mjs` (new gate, in `npm test`)** inverts
   the check instead of maintaining a blocklist: it reads the current identity
   out of `src/generated/content.ts` and fails if any of those strings appear
   under `src/`, `functions/`, `graph/`, `index.html`, `404.html`, or
   `manifest.json`. It keeps working after a fork renames the persona —
   whatever your identity is, it belongs in YAML.

## What this does NOT close

Honest scope: this ADR makes adoption a config exercise. It does not reach
feature parity with the sibling site (harrison-site / harrisonhalperin.com).
Still open, roughly in value order:

- **Prerendering.** ADR 014 §5 already flagged it. Per-route metadata is
  client-set, so a non-JS crawler sees only the home shell. The sibling
  project's `prerender-routes.mjs` also generates per-route social cards and
  its build refuses to publish an SPA-only `dist` in CI.
- **Structured work fields.** `buildEvidencePack` flattens
  `title + summary + body + skills` into one blob, so Fit quotes prose. The
  sibling site carries `outcome`/`evidence` per project and renders a fixed
  editorial brief.
- **Per-skill `applied` context**, and the tooltips it feeds.
- **`Person` JSON-LD**, deliberately skipped for a fictional persona
  (ADR 014) — but a real adopter needs it, and it can now be generated from
  `profile.yaml` + `site.yaml`.
- **An `llms.txt`** equivalent.
- **The graph as an embedded lens** on home/work rather than only `/graph`.
- **Infrastructure as code.** Setup is dashboard clicks plus
  `wrangler.example.toml`; the sibling project has Terraform for the zone and
  Pages project.

## Consequences

- Adding a user-visible string that names the site owner now fails
  `npm test`. Read it from `SITE_CONFIG` / `SITE_PROFILE` instead.
- `emit-html.ts` and the `index.html` template are coupled: renaming a meta
  tag in the template without updating the emitter fails the build loudly,
  which is the intended trade.
- The `demo` flag is a foot-gun if left `true` on a real site — it is the
  reason `skills/infra-pages/SKILL.md` now lists it as a numbered step with
  its own verification line.
- `check-adopter-config` only matches identity values of 5+ characters; a
  one-or-two-word name would match too much of the repo to be signal. Short
  names are not protected by it.
