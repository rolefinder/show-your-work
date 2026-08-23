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
| the first `content/courses/*.yaml` | Same, for coursework |
| the first `content/certifications/*.yaml` | Same, for credentials |

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

Two more things are worth knowing about what becomes a citation. A `decisions`
bullet is quotable in exactly the same way an `evidence` bullet is, so the
sentence explaining *why* you built it that way can be the one a recruiter
sees. And a bare skill tag is **not** a citation: if a requirement matches only
because the label is in your `skills` list, with no `skill_notes` entry and
nothing on the page saying anything about it, that row is reported as `partial`
rather than `aligned`. Writing a one-line `skill_notes` entry is what turns it
into a claim the brief can stand behind.

## What your work does not yet answer

```bash
bun run fit:audit path/to/a-job-description.txt
```

The matcher already works out which requirements nothing you published covers.
Every display path throws that away — the brief you hand a recruiter is a
highlight, not an audit — so this points the same computation back at you:

```
6 requirements · 3 aligned · 0 partial · 3 uncited
nothing published covers:
  - Deep knowledge of Kubernetes and service mesh operations
  - On-call incident response and postmortem ownership
```

That is a writing queue drawn from real postings rather than guesswork. Save a
few roles you actually want under `./jds/` and run it with no arguments.

It is entirely local — it reads files already on your machine and prints to
your terminal, with no network and nothing stored. `./jds/` is gitignored,
because a job description is someone else's document and your repo is public.

## The profile you already have, still empty

```bash
bun run profile:draft ~/Downloads/Basic_LinkedIn_DataExport.zip
```

A platform profile sits empty not because there is no API but because you do not
know what to put in it. The hard part was never the transport.

LinkedIn will give you a data export, on request, as a member. It states exactly
which sections are blank. This diffs that against your corpus, drafts copy for
the blanks only — an About paragraph from your summary and your project
outcomes, a role description from that role's highlights — prints it, and stops.

Every sentence traces to something you already published. Where the corpus is
silent you get a `TODO:` naming what is missing, never invented copy. Sections
you have already written are left alone unless you pass `--all`.

**It stops at the clipboard, not the credential.** That is deliberate: writing
into your profile would need a stored credential, it would put your own account
at terms-of-service risk during a job search, and the last review before
something becomes a public claim about you should be done by you. No scrapers
are supported and none ever will be — the official export or nothing.

## Coursework and certifications

`content/courses/<slug>.yaml` and `content/certifications/<slug>.yaml`. Both
exist to answer the same problem: early in a career the evidence is coursework,
and a transcript line is not a portfolio entry.

One rule governs both, and everything below follows from it:

> **A course or credential may only claim a skill that one of its own linked
> projects already claims.**

### The syllabus already wrote your skills section

Every course you passed published a skill list before the semester started — the
learning-outcomes section, the one that begins *"upon successful completion of
this course, students will be able to…"*. It was written by the faculty who
teach the course and reviewed through curriculum approval. You do not have to
invent a taxonomy. You have to read one.

```yaml
slug: mis-315-database-systems
institution: Your University
code: MIS 315
name: Database Management Systems
completed: "2022-05"

# Quoted from the syllabus, not paraphrased. It is the institution's claim
# about the course, so it appears as the institution wrote it.
outcomes:
  - Design a normalized relational schema from a business narrative.
  - Write queries that join, aggregate, and filter across several tables.

# What it taught, in your vocabulary. CANDIDATE labels — see below.
taught: [SQL, data modelling, normalisation]

# Work you produced in this course. Published projects only.
projects: [department-content-pipeline]

visible: true
```

There is a helper for the tedious half. Save the syllabus as text — most
viewers export it — and it lifts the outcomes out for you:

```bash
python packages/ingest/from-syllabus-text.py syllabus.txt --slug mis-315
```

It extracts the outcomes verbatim and leaves `taught:` as TODO markers. It will
not name the skills for you, deliberately: turning "design a normalized
relational schema" into `normalisation` is a paraphrase, and these scripts never
paraphrase a source.

### `taught:` publishes nothing on its own

A syllabus establishes what a course **taught**. It does not establish what you
**did**. Passing a database course is not evidence of having modelled a schema,
and treating it as evidence would manufacture exactly the uncited claims this
whole project exists to avoid.

So the build derives your published `skills` as the subset of `taught` that one
of your linked projects already claims, and **drops the rest before they reach
the bundle**. Not hidden by a component — absent from the artifact.

### The leftovers are the point

```bash
bun run skills:gap
```

```
MIS 315 — Database Management Systems
  Your University · 2022-05
  published:   SQL · data modelling
  no evidence: normalisation
  the syllabus says:
    - Design a normalized relational schema from a business narrative.
```

That is not a gap in your resume. It is the next thing to write up, drawn from
work you have already done and phrased in the institution's own words rather
than from a blank page. Publish a project that demonstrates it, tag it with the
same label, and the gate publishes it for you.

A course you have not written up yet lives at `visible: false`. It still feeds
this list; it just does not render.

The project has to be published, not merely listed. If everything a visible
course links is still a draft, nothing attaches to it and it would render as a
bare transcript line — so the build stops and tells you which it is waiting on.

### Certifications run the other way

A syllabus publishes a checkable curriculum and an unverifiable pass. A
certification publishes a **verifiable pass** — a credential number anyone can
check with the issuer, the only fact on your site that does not rest on your own
word — and an unverifiable capability. Issuers say so themselves: the hands-on
experience is what the exam *assumes*, not what it verifies.

```yaml
slug: aws-saa-c03
issuer: Amazon Web Services
name: AWS Certified Solutions Architect – Associate
earned: "2026-03"
expires: "2029-03"
credential_id: ABC123DEF456           # public — it exists to be checked
verify_url: https://example.com/verify  # https only
taught: [IAM authorization design, VPC network design]
projects: [multi-account-iam-baseline]
visible: true
```

The credential renders as an accolade with its verification link. The skills go
through the same gate as a course's — so a certification you earned by
**building** arrives with `projects:` populated and one you earned by revising
does not, and the schema shows you the difference instead of flattening it.

`expires:` is the only machine-readable decay date in the whole corpus. Every
other content type makes you infer staleness from a date; this one states it, so
`bun run ready` tells you when it has passed.

### Neither is ever a citation

Fit never cites a syllabus or a credential. The gated skills live on your
projects, and a project is the better citation anyway — it is the thing you
actually did. This is asserted by `bun run fit:smoke`, not merely intended.
([ADR 032](../architecture/adr/032-curriculum-derived-skills-and-the-evidence-gate.md).)

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

`check-content` **blocks** on near-duplicate labels. Two labels that differ
only in case or punctuation normalize to the same key — `TypeScript` and
`Typescript`, or `CI/CD` and `ci-cd` — so keeping both is a typo, not a
choice. Pick one and the build goes green. A genuinely new skill has a
distinct key and is never flagged.

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
| A `projects:` slug that is not a real project | it would publish a link that 404s |
| A visible course or credential with no `projects:` | a transcript line is not a portfolio entry — attach published work, or set `visible: false` |
| A visible course or credential whose linked projects are all drafts | it would render as a transcript line: both the page and the evidence gate ignore unpublished work, so nothing would attach to it |
| A certification `earned`/`expires` that is not `YYYY-MM` | the build reads these two, it does not only render them |
| A `verify_url` that is not `https://` | a verification link over plaintext is not one |

| Near-duplicate skill labels | including between `profile.yaml` and a project, and including a course's `taught:` |

| Warns on | |
|---|---|
| A skill missing from `skills.yaml` | it renders, it just lands in `fallback` |
| A course or credential whose `taught:` labels publish nothing | usually a spelling mismatch against the linked project, sometimes just work you have not written up |
