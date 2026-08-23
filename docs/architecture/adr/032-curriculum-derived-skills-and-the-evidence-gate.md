# ADR 032: Curriculum-derived skills, certifications, and the evidence gate

**Status:** Accepted · 2026-08-23

## Context

This template answers a recruiter who has already arrived: it makes published
work legible, and it refuses to call anything *aligned* without a citation. That
works for someone whose evidence is employment. It does much less for someone
whose evidence is coursework, which is most people early enough in a career to
need a portfolio at all.

Two things are missing for them, and they are different problems.

**A vocabulary problem.** One body of work gets called "database design" in one
place, "SQL" in another and "relational modelling" in a third. No search over
that pool retrieves it. The usual fix is to have an institution define a
canonical skill list and maintain it — which requires a department with a
budget, authority over students, and the willingness to spend that authority on
taxonomy compliance.

**A credibility problem.** The obvious way to close the vocabulary gap is to let
people assert skills. That is a throughput improvement, not a credibility one:
a claim propagating faster is still a claim. Being findable and unbelievable is
not obviously better than being neither.

## Decision

One rule generates the whole design:

> **The authority already wrote it down. Read the document instead of asking
> someone to build one.**

And one rule governs what any of it may publish:

> **A skill may be published only when something the candidate published
> demonstrates it.**

### Two corpora, resolved like every other

`content/courses/<slug>.yaml` and `content/certifications/<slug>.yaml`, under
the same `corpus_dir()` rules as `work/` and `blog/` — demo fallback, wholesale
switchover (ADR 021). No resolver change was needed.

A course carries `institution`, `code`, `name`, `completed`, `outcomes`,
`taught` and `projects`. A certification carries `issuer`, `name`, `earned`,
optional `expires`, `credential_id`, `verify_url`, plus the same `taught` and
`projects`.

### The taxonomy is read, not built

A skill list for a course already exists, published, written by the faculty who
teach it and reviewed through curriculum approval: the learning-outcomes section
of the syllabus, the one that begins *"upon successful completion of this
course, students will be able to…"*. Nobody has to build it. It has to be read —
and the student already holds it, which is what removes the dependency on
institutional cooperation entirely.

`outcomes:` is quoted from that section rather than paraphrased. It is the
institution's claim about the course, so it appears as the institution wrote it.

### `taught:` is candidate vocabulary, never a claim

A syllabus establishes what a course **taught**. It does not establish what a
student **did**. Passing a database course is not evidence of having modelled a
schema, and a system that treated it as evidence would manufacture exactly the
uncited claims this project exists to prevent.

So `taught:` publishes nothing on its own. `packages/content/emit_site.py`
derives `skills` as the subset of `taught` that one of the entry's own linked,
visible projects already claims, and drops the remainder.

### The gate runs at the emit boundary

Not at render time, and the difference is the whole safety property. Deriving it
in the browser would put the ungated `taught:` list in the bundle, where an
unevidenced label is one rendering bug away from being published. Deriving it at
emit means the label is **absent from the artifact** — there is no bug that
publishes it.

The remainder never reaches a build artifact either. It is the author's writing
queue, printed by `bun run skills:gap`, which reads the YAML directly.

### Three consequences, for free

- **No new labels.** Courses and certifications draw on the same vocabulary, so
  `check-content`'s one-spelling rule covers them with a two-line change. (They
  are held out of the `skills.yaml` *category* warning, because a label that
  publishes nowhere has no chip to categorize.)
- **No new documents.** Neither corpus enters the Fit evidence pack. No citation
  can resolve to a syllabus or a credential — the citation is always the
  project, which is the better citation anyway. `fit-smoke` asserts this rather
  than assuming it.
- **No orphan entries.** A visible course or credential must link at least one
  published project. This is the project's thesis applied to coursework: a
  transcript line is not a portfolio entry; a transcript line attached to a
  published artefact is. An entry with nothing to attach lives at
  `visible: false`, where it still feeds the writing queue.

### Certifications invert the evidence, and the schema says so

A syllabus publishes a checkable curriculum and an **unverifiable pass**. A
certification publishes a **verifiable pass** — a credential ID anyone can check
with the issuer, the only fact on the site that does not rest on the author's
word — and an unverifiable capability. Issuers are candid about this: the
hands-on experience is framed as something the exam *assumes*, not something it
verifies.

So the two halves get different treatment. The credential renders as an accolade
with its verification link, and is **not citable in a Fit brief** — a title like
"Solutions Architect" is a bag of generic tokens and precisely the
false-positive hazard ADR 027 documents. The capability goes through the same
gate as a course's.

The schema also distinguishes a certification earned by **building** from one
earned by **revising**: the first arrives with `projects:` populated and the
second does not, and flattening that difference would be the one place this
design lied.

> **The counter-argument, recorded because it is respectable.** A verifiable
> credential differs in kind from a self-asserted tag; it is the one item a
> recruiter could check without trusting the candidate at all. Making it citable
> would mean an authored sentence entering the pack as a claim while the title
> stayed out of the matchable text. That widens the governing rule from *every
> citation traces to work you did* to *…or to a credential someone else issued
> and still vouches for* — defensible, but a **different rule**, to be adopted
> deliberately or not at all. Not adopted here.

### `credential_id` is not a credential

AGENTS.md says never handle a credential, and that rule is about secrets. A
certification number is the opposite of a secret: it is printed on the
certificate and exists to be handed to someone who wants to verify it. `verify_url`
must be `https://`, because a verification link served over plaintext is not one.

### This does not revisit ADR 027's exclusion of education

Recorded explicitly, because it is the thing a future reader will assume
happened. ADR 027 kept education out of the evidence pack on **degree-name
collisions** — "BS, Information Systems" would answer a third of the postings in
the industry. That objection is upheld here, twice over:

- Courses and certifications never enter the pack at all, so the collision is
  structurally impossible for them rather than merely mitigated.
- Education now *does* enter the pack, but only through `achievements[]`, which
  are whole authored sentences carrying none of the collision property. The
  credential names its own citation and matches nothing, via `titleText: ""` on
  the evidence doc. The degree name is still not matchable text.

## Alternatives rejected

**Parse the syllabus PDF automatically.** Syllabi are unstructured documents with
no common format, and a parser that guesses would violate the drafting contract
in ADR 018 — anything a source does not state becomes a `TODO:`, never a guess.
`packages/ingest/from-syllabus-text.py` therefore takes plain text, extracts the
outcomes section verbatim, and leaves `taught:` as TODO markers for a human. It
drafts to stdout and writes nothing.

**Let a course publish its full `taught:` list with a "not yet demonstrated"
badge.** Honest-looking, and wrong. Rendering the label publishes it; a badge is
a caveat next to a claim, and a caveat is what someone stops reading. The
unevidenced list is more useful to the author than to the reader.

**Make the gate a build failure instead of a derivation.** It would force the
author to either delete a label or write the project up before the build goes
green — which turns "here is what to write next" into "the build is broken".
The derivation gets the safety property with none of that; `check-content` still
warns when *nothing* on an entry publishes, because that is usually a spelling
mismatch rather than an empty queue.

## Consequences

- Six corpora. `check-additive` and `check-parity` both know about the two new
  ones; parity now compares all six across nine adopter states.
- `/experience` gains two sections after Education. No new route, no new
  prerendered document, no new sitemap entry — the same reasoning ADR 027 used
  for putting education there.
- `fit-smoke` gained two assertions: neither corpus becomes a citable document,
  and every published skill is claimed by a linked project. Both were verified
  by breaking them.
- The evidence pack grew from 6 docs to 7 — education, not coursework.
- `bun run skills:gap` is new and advisory: exit 0 always, no network, nothing
  written. Same posture as `bun run fit:audit`.
