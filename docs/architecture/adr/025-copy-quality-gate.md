# ADR 025: Rendered copy is linted, because no other gate reads the words

**Status:** Accepted · 2026-08-11

## Context

Every gate in this repo checks **structure**: do slugs resolve, does the
sitemap match known-paths, is the identity absent from code, does the evidence
pack agree across two implementations. Not one of them reads the prose.

That is a real gap for a portfolio, where the defects a visitor notices are
prose defects, and all of them survive a green build. The sibling project this
was ported from found four such defects live on its own site — a job title
written five different ways across six files, status badges contradicting the
body two elements below them, hand-typed read times that were not even
monotonic in article length.

Most of those cannot happen here. Identity is data with exactly one reader
(ADR 016), so there is no second spelling of a job title to drift. There is no
status taxonomy and no authored read time to be wrong. Porting the sibling's
checks verbatim would have added machinery for bugs this template's structure
already prevents.

What *can* happen here is a different set, and one of them is specific to this
template's authoring model.

## Decision

`scripts/check-copy.mjs`, wired in as `copy:check`, last in `npm test`.

It scans **`dist/**/*.html`** — the rendered documents — not `content/**.yaml`.

> This is the whole point of the gate. The rendered page is what ships, and it
> is the only place where an authoring construct that failed to *become*
> something is visible. `{{work:slug|Label}}` is well-formed YAML no schema
> check would question; if the slug is wrong or the target is `visible: false`,
> it reaches the reader as literal braces mid-sentence. You cannot see that in
> the source, because in the source it is correct.

Three checks:

| Check | Catches |
|---|---|
| unrendered cross-link token | `{{…}}` that reached the page unparsed |
| authoring placeholder | `TODO`, `FIXME`, `TKTK`, `Lorem ipsum` in published copy |
| doubled word | "the the", the classic defect nobody catches rereading their own sentence |

`check-ready` already blocks a published `TODO` in *content*. This catches one
that arrives by another route — a demo fallback, an injected template string —
because it asserts over the artifact rather than the input.

### Flattening the DOM correctly

Tags are replaced with **newlines, not spaces**, and the doubled-word pattern
matches `[ \t]+` rather than `\s+`.

> Found the hard way. The first run reported a doubled "content" on the home
> page: the skill-bank heading *"Languages & content"* is immediately followed
> by the skill *"content pipelines"*. Two separate elements, no doubled word on
> the page at all — the adjacency existed only in the flattened string. Spaces
> invent adjacencies across element boundaries; a repeat that spans a newline
> spans two text nodes and is an artefact, never a defect.

Script, style and JSON-LD blocks are stripped first: a repeated token inside
minified JavaScript is not a copy defect.

`had`, `that` and `is` are allowed to repeat, being grammatical in English.

## Consequences

- A broken cross-link fails the build instead of publishing braces at a
  recruiter.
- The gate needs `dist/`, so it runs after the build, alongside the other
  artifact-level checks.
- It is deliberately a small, high-confidence set. A check that fires on good
  prose gets disabled, and then none of it runs — so "evidence bullets should
  contain a number or a URL", which the sibling project's audit suggested, was
  **rejected**: several of this template's own demo evidence lines are strong
  and contain neither.
