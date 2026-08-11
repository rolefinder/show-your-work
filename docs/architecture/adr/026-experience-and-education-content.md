# ADR 026: Experience and education as content types

**Status:** Accepted · 2026-08-11

## Context

The template had two content types, `work/` and `blog/`, both project- or
essay-shaped. Neither is employment-shaped. A portfolio built on it could show
what someone made but not where they worked, which meant the one question a
recruiter opens a portfolio to answer — *what has this person actually done, and
for how long* — had no home.

It also left Fit answering with the wrong evidence. A requirement like "5+ years
building delivery pipelines" was matched against project pages, because project
pages were all there was. Employment history is the evidence for that
requirement, and it did not exist in the corpus.

## Decision

Two new corpora, resolved by the same `corpus_dir()` rules as `work/` and
`blog/` — they fall back to `content/demo/` and switch wholesale (ADR 021), so
no resolver change was needed.

`content/experience/<slug>.yaml` carries organization, role, start, optional
end, summary, highlights, skills, and a curated `projects:` list.
`content/education/<slug>.yaml` carries institution, credential, date, optional
honors, and achievements.

### One route, two types

`/experience` renders roles and then education. Two routes would double the
prerendering, social cards and sitemap entries for a section most people fill
with one or two education entries — and a résumé shows them together anyway.

### `projects:` is curated, never inferred from dates

Every other cross-reference here is an explicit list, and date-range inference
gets the real cases wrong: a personal project runs alongside a job, and a
project straddles a role change. `check-content` resolves each slug against the
work corpus and fails on a dangling one, the same treatment `{{work:…}}` tokens
get — a renamed or unpublished project would otherwise leave the career page
advertising a 404. The page also filters to `visible` work, so an unpublished
draft cannot leak a link.

### "Present" is derived

An absent `end:` renders as "Present". There is no field to leave stale, so a
role cannot claim to have ended when it did not.

### Roles are Fit evidence; education is not

Experience entries join the evidence pack as `kind: "experience"`, with
`highlights` becoming `claims` — the same treatment `work`'s outcome and
evidence bullets get, and for the same reason: they are already whole authored
statements, so a citation is a complete sentence rather than a window cut out of
a paragraph.

Education stays out of the pack. "BS, Information Systems" is not evidence for a
requirement in the sense this matcher means, and adding it would mostly produce
degree-name keyword collisions.

> **The demo corpus taught this lesson immediately.** The first draft gave a
> role the skill `design systems`. `fit-smoke` went red: the requirement *"Rust
> systems programming for embedded devices"* now scored **20** against it and
> came back **aligned**, citing "design systems". A brief would have told a
> recruiter the candidate matched a Rust requirement, with a citation, on the
> strength of a shared word. That is precisely the failure cite-or-missing
> exists to prevent, and it arrived through demo data rather than through the
> engine. The skill is now `design tokens`, which is also what that role
> actually describes.
>
> The general lesson is that adding a corpus adds tokens, and a generic token in
> a skill list is a false-positive citation waiting to happen. The gate caught
> it because the fixture JD contains a requirement the corpus genuinely cannot
> answer — worth keeping one.

### Not wired into the knowledge graph

`/graph` maps how work and writing connect. A role is not a thing you relate
other things to; it is a container. Adding a third node type would mean teaching
the dangling-edge guard and the community detection about it for very little
signal. Deliberately deferred, not overlooked.

### TIL is not in this change

The source ADR this was ported from also defines a "Today I Learned" type, with
no routable page per entry, a bounded recent window rendered inline, and older
entries sharded to per-year JSON fetched on demand. That is a different feature
with its own archive-sharding and crawl-budget reasoning, and it depends on a
drafting automation that does not exist here. Left out on purpose.

## Consequences

- `/experience` is the sixth route and the second nav item, sitting between
  About and Work — career before artifacts.
- The evidence pack grew from 4 docs to 6 on the demo corpus. Both
  implementations changed together, and `fit-smoke` asserts they agree.
- `check-content` validates both types and resolves `projects:` references;
  `check-additive` knows there are now four corpora, so a missing
  `content/demo/experience/` fails rather than silently rendering nothing.
- Adopters who add neither directory get the demo's, exactly as with work and
  blog. Nothing about adoption changes.
