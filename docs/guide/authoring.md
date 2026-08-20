# Authoring

Everything you publish lives in `content/`. One file per project, one per post.

```
content/
  about/profile.yaml      ← you add
  work/<slug>.yaml        ← you add: one project each
  blog/<slug>.yaml        ← you add: one post each
  config/*.yaml           ← you add: identity, skills taxonomy, Fit tuning
  demo/                   shipped. Never edited, never deleted
```

## You only add files

`content/demo/` holds everything the template ships. You never edit it and
never delete it — you write a file at the matching path outside `demo/`, and it
takes over. ([ADR 021](../architecture/adr/021-additive-only-adoption.md).)

| You add | What happens |
|---|---|
| `content/about/profile.yaml` | Your identity replaces the demo persona's, everywhere. Demo mode turns itself off — there is no flag to flip |
| `content/config/site.yaml` | Your origin, title suffix, deploy target and theme. The demo's copy is not consulted at all, not even for keys you leave out |
| the first `content/work/*.yaml` | **All** demo projects leave the site at once. Not merged, not appended |
| the first `content/blog/*.yaml` | Same, for posts |

Two rules there are worth stating plainly, because they are deliberate:

**A config file you add is used whole.** Leave `title_suffix` out and it is
empty — it does not fall back to `Fake Name`. A site with your origin and the
demo's name in every page title is a *wrong* site; a site with no title suffix
is merely an incomplete one, and `bun run ready` names it.

**A corpus you add replaces, never merges.** One real project means the two
fictional ones are gone. A portfolio listing two of your projects alongside two
invented ones is worse than one listing two.

The files under `content/demo/config/` are commented in place and are the
authoritative description of their own fields — read them there rather than
here, so there is only one copy to keep true. Copy one out to
`content/config/` when you want to change it. This page covers the content
model, which lives in code and therefore needs documenting.

## A project

`content/work/<slug>.yaml`. **The `slug` field must equal the filename** — the
build fails otherwise, because the slug is the URL.

### Required

| Field | Type | Notes |
|---|---|---|
| `slug` | string | Lowercase, hyphens. Must match the filename |
| `title` | string | Quote it if it contains a colon |
| `summary` | string | One sentence a recruiter can read in three seconds. This is the card |
| `body` | string or list | The prose. One paragraph as a string, or a list of [blocks](#long-form-bodies). Supports [cross-links](#cross-links) |
| `skills` | list | Skill labels. These drive the skill bank, the graph, and Fit's heaviest signal — see [spelling](#skills-are-a-taxonomy-not-tags) |

### Optional

| Field | Type | Notes |
|---|---|---|
| `visible` | bool | Defaults to `true`. `false` keeps a draft out of the built site entirely |
| `date` | string | `YYYY-MM` or `YYYY-MM-DD`. Anything else fails the gate |
| `problem` | string | What was broken before this existed |
| `outcome` | string | What is true now that was not true before |
| `evidence` | list | Concrete, checkable statements |
| `decisions` | list | A choice you made, and why the alternative lost |
| `skill_notes` | map | Skill label → how it applied *here* |

A post (`content/blog/<slug>.yaml`) takes the required five plus `visible` and
`date`. No editorial contract — a post argues, it does not report an outcome.

## The editorial contract

`problem` / `outcome` / `evidence` / `decisions` are optional, and skipping
them is the single biggest quality difference between two sites built from this
template.

Here is why. Fit's job is to answer a recruiter's requirement by quoting your
published work. It can only quote text that already exists in `content/`, which
is what makes it trustworthy — it cannot invent an employer, a date, or a
metric. But that also means **the quality of the quote is the quality of your
YAML**.

Without the contract, Fit falls back to a window cut out of `body`:

> "…wires GitHub Actions to a Pages preview deploy, runs fit-smoke and build
> gates, and pairs with…"

With it, `outcome` and `evidence` become self-contained *claims* in the
evidence pack, so the citation is a whole statement:

> "Merges are blocked until the emitted content, the built bundle, and the
> deployed preview all agree, so a drifted build cannot reach production."

Write each `evidence` bullet so it survives being read alone, with no
surrounding paragraph. That is the whole trick.

`bun run ready` warns — it does not block — on a project with no `outcome` or
`evidence`, and tells you Fit will quote fragments there.

## Long-form bodies

A `body` can stay a single string — that is one paragraph, and it is still the
right shape for most project pages:

```yaml
body: >
  One paragraph, folded across as many source lines as you like.
```

When a page needs more than a paragraph, write a list instead. A bare entry is
a paragraph; the rest are single-key blocks:

```yaml
body:
  - >
    A paragraph. Cross-links work here and in every block below.

  - h2: A section heading
  - h3: A sub-heading

  - list:
      - A bullet
      - Another bullet
  - list:
      - A numbered step
    ordered: true

  - quote: >
      Someone else's sentence.
    cite: Who said it

  - code: |
      bun run build
    lang: bash

  - note: >
      An aside the reader can skip.
```

`content/demo/blog/fake-post-cite-or-missing.yaml` uses every block, and is the
page to copy from.

**Write prose entries as `>` block scalars.** A plain YAML scalar ends at the
first `": "`, so a cross-link label containing a colon —
`{{work:slug|Fake Project: Merge Gate}}` — is a parse error without one. The
same applies to any sentence with a colon in it.

Two rules the build enforces, both because the alternative is silent:

- **A misspelled or misshapen block fails the build.** `h1:` or `attribution:`
  names the file and the block index rather than being skipped, because a
  section that quietly disappears looks exactly like one you never wrote. So
  does `list: one bullet` — a `list` needs `- ` items, and a bare string there
  would publish one bullet per letter. A bullet containing `": "` must be
  quoted, or YAML reads it as a mapping.
- **Code blocks are not part of the Fit corpus.** Fit cites by quoting text from
  your pages, and half a line of shell is not a claim about your work. Code is
  rendered, indexed by nothing, and never quoted back to a recruiter. Every
  other block is prose you wrote and is fair to cite.

`image` and `figure` blocks are not implemented yet — each needs a subsystem
this template does not have (an asset pipeline, a diagram kit). The grammar is
designed to take them without changing what you have already authored.

## Cross-links

Inside `body`, link to another page with a token:

```
{{work:fake-project-merge-gate|Fake Project: Merge Gate}}
{{blog:fake-post-cite-or-missing|cite or missing}}
```

The form is `{{kind:slug|Label}}` where `kind` is `work`, `blog` or `post`, and
`slug` is lowercase letters, digits and hyphens. Rendering happens through the
CSP-safe rich-text path rather than raw HTML.

**A cross-link to a slug that does not exist is a build failure.** It used to
be silent: the site built clean and prerendered a live `href` into a project
page, pointing at a path absent from `known-paths.json` — a 404 on your own
portfolio, reachable by a recruiter, with nothing warning you.

## Skills are a taxonomy, not tags

A skill label is a *key*. It joins your projects to the skill bank, to nodes in
the knowledge graph, to search, and to Fit's highest-weighted signal.

So `TypeScript` and `Typescript` are two different skills. That one-character
typo silently forked the taxonomy: both spellings survived, the misspelling
fell through to the `Other` category, and it split the skill bank, the graph,
search, and matching — all while building green.

`check-content` **warns** on near-duplicate labels rather than blocking,
because a genuinely new skill is legitimate and only you can tell the
difference. Read the warnings.

Give each skill a category and a description in
`content/config/skills.yaml`. A skill with no category falls into `fallback`.
The description pairs with a project's `skill_notes` entry to form the two
halves of a skill tooltip: what this skill means generally, and how you used it
on that project.

## Publishing

`visible: false` keeps a file out of the built site — no page, no sitemap
entry, no graph node. Use it for drafts.

`/build-show-your-work` writes drafted content as `visible: false` with `TODO:`
markers wherever the source did not actually say something. Nothing it could
not trace to a source is ever guessed. You review it, fill the TODOs, and flip
the flag.

`bun run ready` blocks on a **published** file containing `TODO`, and on every
project being an unreviewed draft — which would publish an empty site.

## What the content gate checks

`bun run content:check`, also part of `bun run test`:

| Blocks on | |
|---|---|
| Invalid YAML | with the parser's message |
| A missing required field | instead of a raw `KeyError` from inside the emitter |
| `slug` ≠ filename | the slug is the URL |
| A malformed `date` | anything but `YYYY-MM` / `YYYY-MM-DD` |
| A cross-link to a nonexistent slug | see above |

| Warns on | |
|---|---|
| Near-duplicate skill labels | including between `profile.yaml` and a project |
| A skill missing from `skills.yaml` | it renders, it just lands in `fallback` |
