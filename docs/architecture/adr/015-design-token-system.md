# ADR 015: Design token system (light/dark, a11y floors, drift gate)

**Status:** Accepted
**Date:** 2026-07-24

## Context

The template's visual layer was a placeholder: `tokens/tokens.css` defined
three variables (`--rm-brand`, `--rm-bg`, `--rm-fg`) that nothing used, and
`styles.css` hardcoded every real value — nine literal hex colors, ad-hoc
rem paddings, a serif/sans font pair picked per rule, one radius. Consequences
that mattered for a template specifically:

- **Re-theming a fork meant editing component rules.** The advertised
  "override in adopter forks" contract was not real: `--rm-brand` was
  referenced nowhere, so changing it changed nothing.
- **No dark mode at all.** A cream page on a dark-mode OS is the single most
  visible quality gap against the sibling project (harrison-site).
- **Silent stale-color risk.** `tokens/graph.css` read `var(--radius, 10px)`
  and `var(--line, #ddd5c8)`; neither token existed, so the fallbacks were
  always what painted. Nothing flagged it.
- **Contrast was unmeasured.** Several small-text pairings landed under
  WCAG AA once measured (see Decision 3).

The sibling project (harrison-site, same author) already runs a layered token
system that solves this. This is an adaptation of that structure — the layer
split, the scale shape, the naming — re-expressed for this repo's own
ink-on-cream/teal palette and its own component set. It is not a CSS copy,
and no third-party stylesheet was used as a source (HANDOFF §8.6).

## Decision

1. **Five token layers, one manifest.** `tokens/tokens.css` becomes an
   `@import`-only manifest over `colors.css`, `typography.css`,
   `spacing.css`, `effects.css`, `base.css`. `index.html`'s existing
   `<link>` set is unchanged — the manifest keeps the same URL, so no
   page-level plumbing moved.

2. **Semantic aliases, not raw palette, in components.** Raw values live in
   `tokens/`; `styles.css` reads `--surface` / `--fg-muted` / `--space-4` /
   `--radius-2xl` and never a literal. The four `--rm-*` adopter variables
   at the top of `colors.css` are now genuinely load-bearing: every other
   color derives from them or from an alpha ramp over them.

3. **Contrast floors are a design constraint, not an outcome.** `--fg-muted`
   is deliberately *not* aliased to `--ink-60`, the way the sibling project
   does it: that ramp step also paints borders and fills, and at 0.60 alpha
   it measures 4.42:1 over this repo's cream — under AA for the 12–14px text
   that actually uses it. It is pinned to 0.66 instead. Likewise the three
   state inks were darkened (`--positive` #15803d → #166534, `--caution`
   #8a6100 → #7a5600) so the Fit status badges clear 4.5:1 against their own
   `-soft` fills at 11px. Every text/background pair on the shipped pages was
   measured in both schemes. (An earlier draft of this ADR quoted a 4.54:1
   floor; that figure predates raising --fg-muted and is superseded — every
   pair clears AA.)

4. **Dark mode via `prefers-color-scheme` only.** No toggle, no persisted
   preference, no `data-theme` attribute. A toggle needs storage, an
   inline pre-paint script (blocked by `script-src 'self'` without a hash),
   and a control in the header — disproportionate for a template whose
   adopters can add one. The accent flips to a lighter teal in dark mode
   because #0f5c4c is unreadable on an ink surface.

5. **Status is never color-only.** Fit requirement cards carry the verdict
   in a left rule *and* a text badge ("aligned" / "partial" / "missing"), so
   the state survives color-blindness and grayscale print.

6. **`scripts/check-style-tokens.mjs` (new gate, in `npm test`).** Fails on:
   a raw color literal in the component layer; a `var(--x)` that no file
   under `tokens/` defines (the `--radius, 10px` class of bug above); and a
   missing `--cat-N`, which `src/skills/SkillBank.tsx` builds by name at
   runtime and which CSS-only analysis would therefore never see referenced.

7. **System font stack, no webfont.** `--font-sans` leads with `"Inter"` and
   falls back through each platform's native UI sans. The CSP is
   `font-src 'self'`, so a webfont means committing binary `.woff2` files
   plus their license to an Apache-2.0 repo; adopters who want that only
   need to drop the file in and add one `@font-face`. Shipping zero font
   bytes is the better default for a template.

8. **Chrome parity with the sibling project**: sticky header with a skip
   link, `aria-current="page"` on the active nav item, a real mobile menu
   below 768px (the nav has six targets and wrapped to three rows on a
   phone), 44px minimum touch targets, `:focus-visible` rings, and a
   `prefers-reduced-motion` block that neutralizes every transition.

## Explicitly out of scope this pass

- **A theme gallery** (HANDOFF §8.6's "2–3 themes"). The prerequisite —
  a real override surface — is what this ADR builds; shipping alternate
  palettes on top is now a small change and its own decision.
- **Prerendered critical CSS / inlining.** Three stylesheet requests on a
  static site behind Cloudflare's cache is not the bottleneck.
- **A theme toggle.** See Decision 4.

## Consequences

- Component CSS can no longer carry a literal color; `npm test` fails if it
  does. That is the point, but it means a genuinely one-off color (there are
  none today) must be added to `tokens/` first.
- The gate only understands CSS. A color set from TypeScript escapes it
  unless it is registered in `RUNTIME_TOKENS`, as `--cat-N` is.
- Dark mode now has to be considered for every new surface. Any new raw
  color needs a dark counterpart in the `prefers-color-scheme` block, or it
  will paint a light value on an ink page.
- `manifest.json`'s `theme_color` was `#0b1120` — the sibling project's dark
  background, inherited by copy-paste and never matching this repo's palette.
  It now tracks the real cream background, with paired
  `<meta name="theme-color">` entries per scheme.
