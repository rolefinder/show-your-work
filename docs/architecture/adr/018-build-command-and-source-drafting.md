# ADR 018: `/build-show-your-work`, source drafting, and the links map

**Status:** Accepted
**Date:** 2026-07-25

## Context

ADR 016 made adoption a `content/` edit; ADR 017 made the output competitive.
What remained was the *interaction*: an adopter still had to know which eight
commands to run in which order, and had to author every project from a blank
file. The intended shape is "fill in config, run one command."

Two smaller things surfaced with it:

1. **Fixed profile fields don't scale.** ADR 016 introduced `github` and
   `linkedin` as named fields. The moment a third platform is wanted —
   YouTube, Mastodon, a personal blog — a fixed field list means editing
   `types.ts`, the emitter, the contact row, `llms.txt`, and the JSON-LD
   builder. That is precisely the code-change burden this project gates
   against, reintroduced through the front door.
2. **There was no honest place for "raw material."** Drafting content from an
   adopter's repos or resume is the single biggest lever on time-to-site, and
   also the single biggest integrity risk in a project whose product is
   cite-or-missing.

## Decision

### The links map

`profile.yaml` gains `links:` as a **map keyed by platform**, replacing the
fixed `github`/`linkedin` fields:

```yaml
links:
  github: https://…
  linkedin: https://…
  youtube: https://…
```

Flat and named — which was the point of moving off `[{label, href}]` — but
open-ended. The display label is *derived* from the key
(`src/profile-links.ts`), with an override table only for platforms whose
casing isn't a capitalized key (GitHub, LinkedIn, YouTube, …). Adding
`mastodon:` renders "Mastodon" with zero code change. Authoring order is
preserved through the Python dict and drives render order.

JSON-LD still emits `sameAs` — schema.org's actual property for "other URLs
for this same entity" — now sourced from `Object.values(links)`.

### `/build-show-your-work`

A skill (`.claude/skills/build-show-your-work/SKILL.md`) that orchestrates:
preflight → optional drafting → build → verify the artifact → report.

**`scripts/check-ready.mjs`** does the preflight deterministically rather than
by inspection: placeholder origin, `demo: true`, placeholder name/email,
untouched skills, remaining demo corpus, published-but-TODO content, missing
Python/PyYAML/node_modules — all blockers. Missing Playwright and missing
`outcome`/`evidence` are warnings, because both produce a working site, just a
worse one. It reports placeholders and stops; it never guesses an identity to
get past them.

### Source drafting is opt-in, grounded, and unpublished by default

`content/config/sources.yaml` (optional) names a GitHub user and/or a resume
file. The `draft-content` workflow discovers candidates per source in
parallel, drafts one YAML per candidate, then **adversarially re-checks each
draft against only its own source facts** and returns the ungrounded claims.

Three constraints make this safe enough to ship:

1. **Drafts are written `visible: false`.** An accidental build cannot publish
   something the human hasn't read. `check-ready` blocks if every project is an
   unreviewed draft, and blocks on any *published* file still containing TODOs.
2. **Unknowns become `TODO:` markers, never inferences.** The prompt states
   that a draft full of TODOs is a success and an impressive draft with an
   invented metric is a failure — because a Fit brief will later cite it to a
   recruiter as evidence.
3. **The grounding check is a separate agent** with only the source facts,
   asked to judge the text as written rather than as intended. Self-review by
   the drafting agent would not have caught its own inference.

### YouTube

`links.youtube` works today. Making a channel a *source* is deliberately not
implemented: without captions or speech-to-text there is no grounded text to
draft from, and the alternative — inferring project claims from titles and
thumbnails — is exactly the invention the workflow exists to prevent. The
config file documents it as unimplemented rather than shipping a key that
silently does nothing.

## Consequences

- The workflow writes files. It is opt-in per run, and the skill is explicit
  that it must not be triggered automatically.
- Drafting quality is bounded by the source. A thin README yields a
  TODO-heavy draft — correct behaviour, and more useful than a fluent invention.
- `check-ready` reads YAML with a regex rather than a parser, to keep a
  preflight free of a Node YAML dependency. It reads top-level scalars only;
  anything structural belongs in the emitter, which does use PyYAML.
- Adding a platform label with unusual casing still means touching
  `profile-links.ts` — but only for *casing*. The link renders either way.

## Verification

`check-ready` was run against the demo corpus and reported exactly the six real
blockers, and against a Windows environment where the naive `python -c ""`
probe produced a false negative (an empty argv entry is dropped through the
shell) — fixed to probe with `python -c "pass"` as a single shell string.

The links map was verified end to end: `init` merging an arbitrary `mastodon`
key from `--config` with prompted platforms, and the built artifact carrying
all three demo links in the contact row, `llms.txt`, and JSON-LD `sameAs`.

The workflow script was syntax-checked by wrapping its body in an async
function (top-level `return` is legal in the workflow harness but not to
`node --check`), and its `meta` block verified to be a pure literal.
