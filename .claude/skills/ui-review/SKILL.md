---
name: ui-review
description: Review the built site's UI/UX against the real rendered DOM — contrast, layout, keyboard, hierarchy, responsive behaviour — going beyond what scripts/check-ux.mjs can assert mechanically. Use when the user runs /ui-review, or asks to "review the design", "check accessibility", "how does this look on mobile", or after a visual change.
---

# /ui-review

`npm run ux:check` already asserts the mechanical invariants on every build.
This is for the judgement calls it can't make: hierarchy, rhythm, whether a
page reads well, whether an interaction is discoverable.

**Run the automated pass first.** If it fails, those are facts — fix them
before forming opinions about taste.

## 1. Mechanical baseline

```bash
npm run build && npm run ux:check
```

Covers, across 9 routes × light/dark × 375/1280px: text contrast against the
real composited background, horizontal overflow, WCAG 2.5.8 touch targets
(with both the Spacing and Inline exceptions), a keyboard focus ring, one `h1`
per route, `lang`, non-empty `<title>`, and image alt text.

Report failures verbatim. Do not re-derive them by eye.

## 2. Look at it

```bash
npm run preview
```

Then drive the browser. Check each at **375px and 1280px, in both schemes**:

| Route | What to actually judge |
|---|---|
| `/` | Does the eye land on the name, then the tagline, then the CTAs? Is the contact row findable without hunting? |
| `/work` | Do the cards scan as a list of *outcomes*, or a wall of equal-weight text? |
| `/work/<slug>` | Does the project brief read problem → outcome → evidence, or does the body bury the outcome? Are skill tooltips discoverable? |
| `/fit` | Is it obvious what to paste and what you'll get back? After a run, is the citation the most prominent thing? |
| `/graph` | Is the graph legible at 375px, or a hairball? Does the lens on `/work` add anything at that size? |

## 3. Things a script can't see

- **Hierarchy.** Squint. If everything is the same weight, nothing is.
- **Rhythm.** Are the section gaps consistent, or does one page breathe
  differently for no reason?
- **First paint.** Prerendered HTML is captured at desktop width. On a phone
  there is a moment of desktop nav before hydration swaps it. Judge whether
  that reads as broken.
- **Dark mode is not inverted light mode.** Check that surfaces still layer —
  card above page, header above card — rather than flattening.
- **Empty and long states.** A Fit run with no matches; a project with a very
  long title; a skill bank with 40 chips.

## 4. Report

Separate **facts** (what `ux:check` found, what you measured in the DOM) from
**judgement** (what you think reads badly). Give each a concrete next action.
Do not propose a redesign when the finding is one token.

## Constraints

- **Never change tokens to make a check pass.** If contrast fails, the fix is
  usually the token — but `check-style-tokens` and the contrast floors in
  ADR 015 exist because that's exactly where regressions hide. State the
  proposed value and why.
- **Never edit `styles.css` with a raw colour.** The component layer reads
  tokens only; the build fails otherwise.
- Screenshots need the Browser pane displayed; if it isn't, read the DOM and
  computed styles instead of guessing.
