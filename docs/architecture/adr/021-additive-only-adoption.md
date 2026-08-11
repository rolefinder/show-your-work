# ADR 021: Adoption is additive — you add files, you never edit or delete them

**Status:** Accepted · 2026-07-25

## Context

ADR 016 established that identity is data, not code: standing up a site is an
edit to `content/`, never a change to `src/`. That held. But "an edit to
`content/`" was still an *edit*, and it turned out to cost more than it looked.

What adoption actually required:

- `npm run init` **overwrote** `content/config/site.yaml`,
  `content/about/profile.yaml` and `content/config/fit.yaml` — three tracked
  files, replaced wholesale. Re-running it after writing real content destroyed
  that content.
- `init --replace-content` **deleted** `content/work/fake-*.yaml` and
  `content/blog/fake-*.yaml`.
- `check-ready` blocked with *"still contains the demo corpus (fake-\*.yaml)"* —
  an instruction to delete, enforced as a gate.
- `init --accent` **rewrote a declaration inside `tokens/colors.css`**.
- `demo: true` was a key someone had to remember to flip. Forgetting shipped
  "this corpus is fictional" chrome on a real site; flipping it early turned
  off the gate protecting the demo corpus.

Two consequences, and the second is the expensive one. First, a partly-done
setup produced a *mixed* site — your name over fictional projects, your origin
with the demo's Fit disclaimer. Second, **every adopter's fork diverged from
the template in exactly the files the template keeps changing**, so pulling an
upstream improvement meant resolving conflicts in your own identity. In
practice that means nobody pulls, and the template's later fixes never reach
the sites built from it.

## Decision

**An adopter only ever adds files.** Nothing shipped is edited; nothing shipped
is deleted.

### The demo corpus moves to `content/demo/`

Everything the template ships lives there: `about/profile.yaml`,
`config/{site,skills,fit,sources}.yaml`, `work/fake-*.yaml`, `blog/fake-*.yaml`.
The adopter paths — `content/config/site.yaml`, `content/about/profile.yaml`,
`content/work/*.yaml` — start out **empty**, and `check-additive` fails the
build if the template ever commits a file at one of them.

### One resolver, two rules

`packages/content/paths.py` and `scripts/lib/content-paths.mjs`. Every reader
goes through them.

**Config files fall back whole.** Add `site.yaml` and the demo's is not
consulted at all — not even for keys you left out.

> Rejected: **key-by-key merging.** It is the obvious design and it is wrong
> here. Supplying only `origin` would leave `title_suffix: "Fake Name"` in your
> page titles — a plausible-looking, entirely false site. Missing keys become
> empty instead, and `check-ready` names each one. Incomplete beats wrong.

**Corpora switch wholesale.** One file in `content/work/` and the demo projects
are gone from the site — not merged, not appended. A portfolio listing two real
projects and two fictional ones is worse than one listing two.

### `demo` is derived, not declared

True exactly while `content/about/profile.yaml` has not been added. That file
carries the name, tagline and email on every page and in every JSON-LD `Person`
block, so if it is still the demo's, the deployment is a demo. There is no flag
to forget.

`corpus:check` is now scoped to `content/demo/` **always**, rather than
switching itself off on the flag. Strictly better in both directions: no flag
to remember, and the demo corpus stays protected forever instead of losing its
guard the moment someone flips a boolean.

### Theming is config, not a CSS edit

`site.yaml` gets a `theme:` block. The build writes `dist/tokens/adopter.css`
from it, and `tokens/tokens.css` imports that file **last**, so the four
`--syw-*` variables win without `tokens/colors.css` being touched.
`check-additive` asserts the import is last — anything after it would silently
override the adopter's palette.

### `init` creates; it does not overwrite

It refuses when a target exists and names each collision. `--force` is the
explicit escape hatch. `--replace-content` is gone, replaced by
`--starter-content`, which *adds* example files — there is nothing to delete,
because adding is what switches the corpus.

It also stopped regex-rewriting the demo's `fit.yaml` and now writes a fresh
one. That incidentally removes the CRLF bug class entirely: there is no pattern
to fail to match.

## Consequences

- A fork's diff against the template is **only files the template does not
  have**. Pulling an upstream fix cannot conflict with your identity.
- Misconfiguration degrades to an incomplete site. The emitters tolerate
  missing fields — a partial profile yields empty strings, not a traceback —
  and the gates name what to add.
- `check-ready`'s output is now a list of files to create. No blocker asks
  anyone to delete or edit anything.
- `content/demo/` is permanent, not scaffolding to be cleaned up. It is the
  fallback, and it is what makes a fresh clone build and render at all.
- `check-additive` runs first in `npm test`, because every other gate assumes
  the layout it asserts.
