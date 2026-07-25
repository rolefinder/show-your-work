# Theming

## Four variables

Every color on the site derives from four declarations at the top of
[`tokens/colors.css`](../../tokens/colors.css):

```css
--rm-brand: #0f5c4c;      /* accent — links, focus ring, active state */
--rm-brand-deep: #083d33; /* pressed / heavier accent */
--rm-bg: #f7f4ef;         /* page background (light) */
--rm-fg: #1c1a17;         /* primary ink (light) */
```

`npm run init` sets `--rm-brand` for you if you answer the accent prompt. It
touches only those declarations, never a component rule.

Dark mode follows `prefers-color-scheme` and is derived, not hand-painted —
there is no second palette to keep in sync.

## How it is layered

```
tokens/colors.css       raw palette  ->  alpha ramps  ->  semantic aliases
tokens/*.css            type, spacing, effects, graph
        |
        v
styles.css              components: semantic aliases only
```

`tokens/tokens.css` is the `@import` manifest and the single entry point.
Components read `--surface`, `--fg-muted`, `--space-4` — never `#f7f4ef`, and
never `--ink-60` directly.

That indirection is what makes the four variables work. Change `--rm-bg` and
every surface, border and muted text value moves with it, because they are all
alpha ramps over the same ink rather than independently chosen hexes.

## The rule

**No raw color in `styles.css`.** `npm run style:check` fails on it, and on two
subtler things:

- **A `var(--x)` that resolves to nothing.** This catches the silent-fallback
  bug, where a renamed token leaves `var(--line, #ddd5c8)` quietly painting a
  stale color that looks fine and is wrong.
- **A missing `--cat-N`.** The skill-bank dot palette builds `var(--cat-1)`…
  `var(--cat-8)` as strings at runtime in TypeScript, so CSS-only analysis
  would never see the reference and a delete would look safe.

If you want a value the tokens do not have, add a token. That is the intended
move, not a workaround.

## Contrast is measured, not assumed

Every shipped text/background pair clears WCAG AA (4.5:1) in both schemes, and
`npm run ux:check` re-measures it on every build — 9 routes × light/dark ×
375/1280px, against the **real composited background**.

That last part is load-bearing here. This palette is built almost entirely from
alpha ramps over ink, so a contrast check that reads the RGB triple and
discards alpha will pass a token that is far too faint to read. Seeding
`--fg-muted` down from `0.66` to `0.40` alpha produces 50 findings at 2.47:1;
before compositing was implemented, the same regression passed clean.

So: if you change a color and `ux:check` fails, the check is right. Semantic
inks like `--danger` are each darkened to clear 4.5:1 against their own
`-soft` fill, because the Fit status badges set them at 11px on exactly that
pairing.

`/ui-review` covers the judgement a script cannot make — hierarchy, rhythm,
whether a page reads well. Run `ux:check` first; those findings are facts.
