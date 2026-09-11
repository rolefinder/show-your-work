# Candidate legibility — findings and proposed mechanisms

**Date:** 2026-08-22 · against `main` @ `8c161a1`

Every finding below was reproduced against this codebase, with the file, line and
measurement recorded. Nothing here is inferred from reading alone, and nothing
here depends on a source a reader cannot open — each defect can be confirmed by
running the command or opening the file named beside it.

Scope is the matcher, the content model and the gate suite. Design, deploy and
CI are out of scope except where a gate is the fix.

> **Origin.** These findings came out of evaluating an outside proposal for the
> same problem — making a candidate legible to a recruiter. That proposal is not
> reproduced or assessed here: it was a prompt, not evidence, and everything
> below stands on this tree instead. What survived the abstraction is recorded in
> Part 2 as mechanisms, not as commentary on someone else's work.

---

## The shape of the problem

A candidate's work fails a recruiter in three separable ways, and this project
currently addresses two of them well and one not at all.

**The vocabulary is inconsistent.** One body of work gets called "database
design" in one place, "SQL" in another and "relational modelling" in a third. No
search over that pool retrieves it reliably.

**The claim is uncited.** A resume bullet asserts a capability; nothing on the
page demonstrates it. The reader's only options are to believe it, discount it,
or spend an interview finding out.

**The work is not addressable.** Real artefacts sit in a submission portal, a
private repo, or a laptop. A claim that cannot be linked cannot be checked — and
increasingly cannot be read by an agent, which means it does not participate in
screening at all.

This project's answer to the first is to put the translation layer in the
*matcher* rather than in the candidate's prose — `synonyms`, `extra_stops` and
`skill_weights` in `content/config/fit.yaml`. That is the right place for it, and
the reason is worth stating because it governs everything in Part 2:

> **A translation layer can be wrong without being a lie.** A bad synonym mapping
> misses a match. A candidate who restates their work in someone else's
> vocabulary to win a filter has made a claim they cannot cite.

The answer to the second is cite-or-missing. Part 1 finds that rule is narrower
in practice than it reads. The third is largely unaddressed for anyone whose work
is coursework rather than employment; Part 2 proposes the mechanisms that would
change that.

---

## Part 1 — Defects in this tree

Eight, in severity order. Five are live regardless of whether anything in Part 2
is ever built.

### F1. A bare skill label can satisfy the citation requirement — FIXED

**Severity: critical** — this is the guarantee the project rests on.

`README.md` promises that `aligned` requires at least one citation, and
`src/fit/match.ts:48-51` enforces the status rule:

```ts
// Hard rule: aligned requires ≥1 citation
if (status === "aligned" && evidence.length < 1) {
  status = "not_evidenced_on_site";
```

But the *content* of that citation degrades to a bare label.
`src/fit/index.ts:47`:

```ts
if (!skillQuote) skillQuote = doc.skillNotes?.[skillMatch] || skillMatch;
```

then `:60` — `const quote = claimQuote || skillQuote || snippetQuote;` — and
`:66` — `quote_or_skill: quote || doc.skills[0] || doc.title`.

**Repro, from shipped defaults.** `src/fit/config.ts:91-96` sets `skill: 14` and
`alignedMin: 20`. Two skill-term matches score **28 ≥ 20 → `aligned`**. With no
`skill_notes` authored, the citation rendered to a recruiter is the bare word
`TypeScript`.

**And the default new-adopter state is the exposed one:**
`scripts/init-site.mjs:271` scaffolds `skill_notes: {}`.

The code already knows the hierarchy — the comment at that site reads *"a whole
authored claim (outcome / evidence bullet) reads as a citation; a skill tag is a
label."* It is correctly ordered; the threshold simply lets the label clear the
bar.

**Resolved: a label-only citation may not reach `aligned`.** `retrieveEvidence`
now returns a `quote_kind` on every hit — `claim`, `skill_note`, `snippet` or
`label` — and `matchFit` requires at least one non-`label` hit before it will
assign `aligned`. Such a row lands `partial` instead, which is the honest
verdict: the skill is genuinely tagged, and nothing published says anything
about it. The bare label also dropped below a text snippet in the quote
preference, since a truncated piece of real prose is more of a citation than
the tag echoed back.

The first attempt at this fix was incomplete, and the way it failed is worth
recording. `buildEvidencePack` joined each doc's `skills` into its `text`, so a
skill match also set a *snippet* — a window cut out of the skill list — which
counted as a citation and sailed past the new gate. It also meant one tagged
skill scored `skill + corpus = 20`, reaching `alignedMin` on its own rather
than needing two.

So skills left the corpus text entirely, in both implementations. They already
have a heavier, dedicated match path; including them again double-counted the
score and let `snippetAround` quote the tag back as though it were prose.
`text` is what can be *quoted* as well as what scores, so it holds prose only.

`fit:smoke` asserts the outcome **through `buildEvidencePack`**, not on a
hand-written doc. That distinction is the whole lesson: the first check
constructed its own `EvidenceDoc` and omitted the skills-in-text that
production always adds, so it passed green while the shipping path still
returned `aligned`. It now also asserts directly that no doc's `text` contains
its own skill labels.

Removing the double-count then broke the other half of the contract, which a
second review round caught. With skills out of `text`, a tagged skill scored 14
whether or not the adopter had written a `skill_notes` entry — so the authoring
guide's promise that writing one is what earns `aligned` became false, and
nothing would have noticed.

So an authored note now scores. A tagged skill alone reaches `skill` (14),
short of `alignedMin` (20); backed by a note it reaches 20. The points are for
the note *existing*, not for it repeating the requirement's wording — a note
reading "every content shape is a compile error" is evidence for `TypeScript`
whether or not it says "TypeScript", and scoring it any other way would reward
keyword echo, which is the behaviour this whole finding exists to prevent.

Measured through the real builder, all three cases:

```
no note at all               score=14 kind=label       -> partial
note NOT repeating the term  score=20 kind=skill_note  -> aligned
note repeating the term      score=20 kind=skill_note  -> aligned
```

Both directions are gated in `fit:smoke`, because a contract that is only
documented is the one that quietly stops being true. The demo still produces
three aligned rows for its CI/CD fixture — the same count as before this
finding, now earned through the skill notes it actually authored rather than
through a double-counted tag.

### F2. The matcher computes the author's to-do list, then discards it — FIXED

**Severity: high** — highest-value opportunity here.

`matchFit` evaluates **every** extracted requirement and assigns `missing` /
`not_evidenced_on_site` — a ranked list of what the adopter should go write. All
three paths then destroy it:

- highlight mode (`show_gaps: false`, the default) filters those rows out of the
  brief;
- the browser path never transmits them (`PRIVACY.md`: *"Close the tab and it is
  gone"*);
- `/api/fit` stores nothing.

Generated on every run, and **no file in the repo turns it toward the author.**

**Fixed** by `bun run fit:audit` (M5), which runs the same matcher over local
job-description files with `showGaps: true` and reports coverage per file plus
the uncited list. Entirely local — no network, no storage, no visitor — so the
privacy posture is untouched. `./jds/` is gitignored, because a saved posting
is a third party's document and an adopter's repo is public.

### F3. Education is structurally uncitable — FIXED

**Severity: high** for anyone whose evidence is coursework.

`buildEvidencePack` (`src/fit/evidence.ts`) loops exactly four kinds — `about`,
`work`, `blog`, `experience` (lines 14, 32, 48, 67). `grep -c education
src/fit/evidence.ts src/fit/index.ts` returns `0` in both.
`functions/api/mcp.ts:106` lists the same four.

The asymmetry against `experience` is total:

| | `skills` | `projects` | evidence pack | skill bank | graph |
|---|---|---|---|---|---|
| work | ✅ | — | ✅ | ✅ | ✅ |
| blog | ✅ | — | ✅ | ✅ | ✅ |
| experience | ✅ | ✅ | ✅ | ❌ | ❌ |
| **education** | **❌** | **❌** | **❌** | **❌** | **❌** |

`EducationItem` (`src/types.ts:119-127`) has neither field; `ExperienceItem` has
both (`:110`, `:114`).

ADR 027 justifies the exclusion on degree-name collisions — sound **for degree
names**. It does not cover `achievements[]`, which holds whole authored
sentences. The demo's own:

> `- Capstone built a fictional content pipeline that a department actually used.`

That is structurally identical to a `work.evidence` bullet, carries none of the
collision property the ADR objects to, renders on `/experience`, and is citable
by nothing.

**Fixed**, and narrowly. Education enters the pack as `kind: "education"` with
`achievements[]` as `claims` — nothing else. The credential names its own
citation and matches nothing, through a new `titleText: ""` on the evidence doc,
so ADR 027's degree-name objection is upheld rather than revisited. `fit:smoke`
gates both directions: a degree name must not retrieve its own doc, and an
achievement must cite as a whole claim.

### F4. `decisions` scores but cannot be quoted — FIXED

**Severity: medium** · cheap fix

`src/fit/evidence.ts:27` builds claims as `[w.outcome, ...(w.evidence || [])]`.
`w.decisions` joins `doc.text` at `:35` but never `claims` at `:39` — so a
project's best-reasoned sentences are matchable but only citable as a 160-char
`snippetAround()` window cut mid-sentence.

**Fixed** in both implementations — `evidence.ts` and `scripts/emit-evidence.py`
— because `fit:smoke` compares the two packs field by field and would fail on
either alone. `decisions` also left the flattened `text`, since claims are
already spread into it and a duplicate would double-count in scoring.

### F5. The matcher cannot represent duration — FIXED (by saying so)

**Severity: medium** — a hole in the trust story, not only an authoring one.

`DEFAULT_STOP` (`src/fit/config.ts:70`) contains `experience`, `experienced`,
`years`, `year`. So "5+ years building delivery pipelines" tokenizes to roughly
`{5+, building, delivery, pipelines}`, and a single project about pipelines can
return `aligned` against it — with a real citation, against a requirement the
candidate may not meet.

ADR 027 added the `experience` corpus partly because such requirements were being
matched against project pages. That gave the matcher better documents to cite. It
did not give it the ability to represent time.

**Fixed, and not in the obvious way.** The matcher still cannot read time and
this does not pretend it can. `statesDuration()` detects the phrase, the row's
`why` says *"Matched on substance only — \"5+ years\" is a length of time, which
this matcher does not evaluate"*, and the brief carries one caveat saying the
same. The status is deliberately **not** downgraded: that trades a false
positive for a false negative against the author, in the one direction they
cannot correct by writing more. [ADR 033](../architecture/adr/033-what-the-matcher-cannot-represent.md)
records why, and why summing `experience.start`/`end` is not available.

### F6. Two of four descriptions of the skill rule are inverted — FIXED

**Severity: medium** (documented contract contradicts the code)

`scripts/check-content.py` **blocks** on near-duplicate skills — it appends to
`errors`, not `warnings`. `README.md` and `ARCHITECTURE.md` describe this
correctly. Two places do not:

- `scripts/check-content.py:18`, its own docstring: *"Warns on (2)…"*
- `docs/guide/authoring.md:196`: *"`check-content` **warns** on near-duplicate
  labels rather than blocking"*, repeated in its table.

**Fixed.** Both now say it blocks, and both explain why that is right rather
than harsh: two labels differing only in case or punctuation normalize to one
key, so keeping both is a typo. A genuinely new skill has a distinct key and is
never flagged. The table row moved from *Warns on* to *Blocks on*.

### F7. The demo corpus ships the fragmentation its gate exists to prevent — FIXED

**Severity: medium**

The gate normalizes by stripping non-`[a-z0-9]` and lowercasing, so it catches
`TypeScript`/`Typescript` but not semantic variants. The shipped demo carries
three overlapping labels, passing green:

```
pipelines                content/demo/work/fake-project-merge-gate.yaml:17
content pipelines        content/demo/work/fake-project-content-emit.yaml:14
YAML content pipelines   content/demo/about/profile.yaml:15
```

Three chips, three graph nodes, three search entries, three weight buckets — in
the corpus that models good practice for every adopter.

**Fixed.** The three labels are now one (`pipelines`), taking the demo
vocabulary from 14 to 12. `scripts/skills.mjs` also grew `experience`, so the
advisory tool and the blocking gate finally agree on scope.

Still open, and deliberately separate: `src/app.tsx:431` passes only
`[...visibleWork, ...visibleBlog]` to `collectSkillCounts`, so experience and
profile skills never reach the skill bank even though `check-content` gates
them. That is a rendering decision, not a vocabulary defect.

### F8. No gate measures time — PARTLY CLOSED

**Severity: medium**

The 18 gates in `package.json` are all structural. Nothing notices that
`content/` has gone stale: a `work` entry dated `2026-06` stays published and
citable in 2029, quoted with identical confidence.

ADR 027 frames the open-ended `experience` entry as a feature — *"There is no
field to leave stale, so a role cannot claim to have ended when it did not."*
True of the *display*, and inverted for *truth*: an absent `end:` is the one
field that silently becomes a lie.

**Partly closed.** `bun run ready` now warns on work past an opt-in
`freshness.stale_after_days`, and on an expired certification whether or not
that key is set — a certification's `expires:` is the first machine-readable
decay date the corpus has ever had. Both read the authored `date:` scalar, never
mtime and never git history.

**Still open, and it is the harder half:** an open-ended `experience` entry has
no date to check at all, so nothing here notices a role that ended two years
ago. Fixing that means either a field that can go stale — which is what ADR 027
avoided — or parsing `start`/`end`, which ADR 033 declines for the same reason.

---

## Part 2 — Proposed mechanisms

One design rule generates all of these:

> **The authority already wrote it down. Read the document instead of asking
> someone to build one.**

A skill taxonomy does not have to be invented and maintained by an institution
willing to do so. It already exists, published, in two places most early-career
candidates already hold: the learning-outcomes section of a course syllabus, and
the exam guide of a professional certification. Neither requires anyone's
cooperation to read.

And one rule governs what any of them may publish:

> **A skill may be published only when something the candidate published
> demonstrates it.**

### M1. Curriculum-derived skill vocabulary — SHIPPED

Parse learning outcomes from the syllabi of courses the candidate passed —
`syllabi:` in `content/config/sources.yaml`, parser alongside
`packages/ingest/from-resume-text.py`, obeying the same contract those already
do (drafts land `visible: false`; anything the source does not state becomes a
`TODO:`, never a guess).

A syllabus establishes what a course **taught**. It does not establish what the
student **did**. So an outcome becomes a *candidate* label, publishable only
under the gate in M3.

The unevidenced remainder is the useful output:

```
MIS 315 taught: SQL · data modelling · normalisation · transaction control
  published evidence: SQL, data modelling
  no evidence yet:    normalisation, transaction control
```

That names what to write up next, drawn from work already done, phrased in the
institution's own words rather than from a blank page.

**Shipped**, with one change from the specification above. There is no PDF
parser: syllabi have no common format, and a parser that guessed at structure
would break ADR 018's drafting contract. `packages/ingest/from-syllabus-text.py`
takes plain text, extracts the outcomes list verbatim and leaves `taught:` as
TODO markers — naming the skill behind an outcome is a paraphrase, and the
contract forbids paraphrasing a source. The output is
`bun run skills:gap`.

### M2. Certifications, where the evidence is reversed — SHIPPED

A certification is the same kind of source with its evidential shape inverted. A
syllabus publishes a checkable curriculum and an unverifiable pass. A
certification publishes a **verifiable pass** — a credential ID anyone can check
with the issuer, the only fact on the site that does not rest on the candidate's
word — and an unverifiable capability. Issuers are candid about this: AWS states
its target candidate already has "at least 1 year of hands-on experience,"
framing the hands-on work as a prerequisite the exam assumes rather than one it
verifies.

Issuers also do the classification for us. AWS's exam guide splits every task
statement into two labelled lists:

```
Task Statement 1.1: Design secure access to AWS resources
  Knowledge of:  AWS federated access and identity services (for example, IAM)
  Skills in:     Designing a flexible authorization model that includes IAM
                 users, groups, roles, and policies
```

**"Knowledge of" is what you know; "Skills in" is what you can do.** Only the
second becomes a candidate label.

Three tiers, with different rights:

1. **The credential is an accolade** — issuer, code, date, expiry, verification
   link. Rendered, independently checkable, and deliberately **not** citable: a
   title like "Solutions Architect" is a bag of generic tokens and exactly the
   false-positive hazard ADR 027 documents.
2. **The "Skills in" list is candidate vocabulary**, gated by M3.
3. **The labs are work entries**, and they carry the citations. A certification
   earned by building arrives with this tier populated; one earned by revising
   does not, and the schema should make that visible rather than flatten it.

```yaml
slug: aws-saa-c03
issuer: Amazon Web Services
name: AWS Certified Solutions Architect – Associate
earned: "2026-03"
expires: "2029-03"
credential_id: ABC123DEF456
verify_url: https://cp.certmetrics.com/amazon/en/public/verify/credential
skills: [IAM authorization design, VPC network design]   # each gated by M3
projects: [multi-account-iam-baseline]
visible: true
```

**Recommendation: not citable in a Fit brief**, for the collision reason above,
and because the route into Fit already exists and is stronger — the gated skills
live on the projects, and a project is the better citation.

**The counter-argument, recorded because it is respectable:** a verifiable
credential differs in kind from a self-asserted tag; it is the one item a
recruiter could check without trusting the candidate at all. Making it citable
would mean an authored sentence entering the pack as a claim while the title
stays out of the matchable text. That widens the governing rule from *every
citation traces to work you did* to *…or to a credential someone else issued and
still vouches for* — defensible, but a different rule, to be adopted
deliberately or not at all.

**One property nothing else in the corpus has: a machine-readable expiry.** Every
other content type forces you to infer decay from a date. A certification states
it, which makes `expires:` the first legitimate consumer of the time gate F8 says
we lack.

**Shipped as specified**, including the recommendation: not citable. `expires:`
is wired to `bun run ready`, which warns on a passed date whether or not the
opt-in freshness window is configured.

### M3. The evidence gate — SHIPPED

> **A course or credential may only claim a skill that one of its own linked
> projects already claims.**

Three consequences fall out without further machinery. Courses and certifications
introduce **no new labels**, so the existing one-spelling rule covers them for
free. They introduce **no new documents** into the evidence pack, so no citation
can ever resolve to a syllabus or a credential — the citation is always the
project, and ADR 027's collision hazard is structurally impossible rather than
merely mitigated. And neither can appear at all unless it produced something
published.

That last property is this project's thesis applied to coursework: a transcript
line is not a portfolio entry; a transcript line attached to a published artefact
is.

**Shipped, and in a better place than this specified.** The subset is derived in
`packages/content/emit_site.py` rather than asserted in `check-content.py`, which
turns the gate from a rule into a structural fact: an unevidenced label is
absent from the artifact, so no rendering bug can publish one. `check-content.py`
still blocks a visible entry with no published work attached, and warns when an
entry's labels publish nothing — usually a spelling mismatch rather than an
empty queue.

`fit-smoke` asserts both halves, and both were verified by breaking them: the
two corpora never become citable documents, and every skill they publish is
claimed by a linked project. [ADR 032](../architecture/adr/032-curriculum-derived-skills-and-the-evidence-gate.md).

### M4. Profile draft export — SHIPPED

Platform profiles sit empty not because there is no API but because the candidate
does not know what to put in them. The hard part was never the transport.

A member-initiated LinkedIn data export states which sections are empty. Diff it
against the corpus, draft copy for the gaps only — an About paragraph from the
profile summary and published project outcomes, an Experience description from a
role's `highlights` — and emit a file. Every sentence traces to something already
written and published; anything the corpus does not state emits a `TODO:`.

The candidate reads it, edits it, pastes what they want. **The flow stops at the
clipboard, not the credential** — and that boundary is the feature. See Part 3
for why the write path is excluded rather than merely unbuilt.

**Shipped** as `bun run profile:draft`
(`packages/ingest/from-linkedin-export.py`), reading the export as a `.zip` or an
unzipped directory. One design note worth keeping: no column name is hardcoded.
LinkedIn has renamed export columns before, and a parser that silently found
nothing would report "you have nothing to add" — the single most misleading
output this could produce. Headers resolve from a candidate list, and a miss
names the file, the candidates, and the columns that were actually present.

### M5. Self-audit and freshness — SHIPPED

Closes F2 and F8, and neither needs new matching logic or a change to the privacy
posture, because neither involves a visitor.

**`bun run fit:audit`** — run local JD fixtures against the local corpus with
`showGaps: true` and print coverage:

```
19 requirements · 6 aligned · 4 partial · 9 uncited
uncited: "experience with container orchestration"
         "familiarity with incident response"
```

**Staleness as a `check-ready` warning**, not a blocker — ADR 018's precedent is
exact: *"Missing Playwright and missing `outcome`/`evidence` are warnings, because
both produce a working site, just a worse one."* Optional
`freshness.stale_after_days` in `content/config/site.yaml`.

**Implementation trap worth naming:** read the `date:` scalar out of the YAML,
not filesystem mtime and not git history. A fresh clone rewrites every mtime and
CI shallow-clones lose history — either would report "everything is stale" on a
clean checkout.

**Both halves shipped**, and the trap was heeded. One refinement found while
building it: a `YYYY-MM` date is read as the *end* of that month rather than the
start. Reading it as the start ages an entry by up to a month and warns early,
and a gate that nags before it should is one an adopter learns to ignore.

---

## Part 3 — What is excluded, and why

These are not gaps in a roadmap. Each is ruled out by a constraint this project
already enforces, and recording them prevents the same proposals arriving again.

**Writing into a third-party profile.** Needs a stored credential
(AGENTS.md: *"Never handle a credential"*), a runtime third-party fetch — which
`scripts/check-free.mjs` fails, with the comment *"A Function reaching a
third-party host is the classic cost leak"* — and it puts the candidate's own
account at terms-of-service risk during a job search. The PRD already adjudicated
this for LinkedIn (§8): scrapers are *"out of supported scope"*; the supported
path is the member-initiated export with a deterministic parser and diff-then-
confirm. M4 is that path.

**Anything needing two-party durable state** — applications, scheduling, offer
feedback. `check-free.mjs:32` bans D1, R2, Durable Objects, Queues, Vectorize,
Workers AI, Hyperdrive and Browser Rendering outright. This is worth stating
positively: those features are excluded by ADR 028 as a *derived consequence*,
not omitted by oversight.

**Centralized storage of anyone's data.** `PRIVACY.md` opens: *"In the default
build: nothing… no collection mechanism ships in the template at all."* Adding a
store would require that file to be rewritten rather than patched, and would
create the one thing the architecture currently makes impossible: a breach.

**Efficacy measurement.** No analytics, by design — the JD never leaves the
browser. The consequence is worth naming as a *trade* rather than an oversight:
**this project has an excellent integrity metric and no efficacy metric at all.**
Every gate is a negative assertion about the build; none is a positive assertion
about an outcome. M5 is the version that gets the benefit without the plumbing —
it measures the corpus, not the visitor.

---

## Sequencing

All eight are done. They are kept here rather than deleted, because the reasons
are the useful part — and because two of them were resolved differently than
this document first proposed.

Every mechanism in Part 2 is now built.

1. ~~**F1** — decide whether a label-only citation may reach `aligned`.~~ Done:
   it may not, and an authored `skill_notes` entry is what earns it.
2. ~~**F4, F6, F7** — one-line fixes and doc corrections.~~ Done.
3. ~~**M5 `fit:audit`**~~ Done.
4. ~~**F3** — `education.achievements[]` into the pack as claims.~~ Done, with
   `titleText: ""` keeping the credential out of the matchable text.
5. ~~**M5 staleness warning**~~ Done. `site.yaml` gained the key; no ADR was
   needed, because it changes nothing about what publishes.
6. ~~**M1 + M3** — syllabus ingest and the courses corpus.~~ Done.
   [ADR 032](../architecture/adr/032-curriculum-derived-skills-and-the-evidence-gate.md)
   records that it deliberately does not revisit ADR 027's exclusion of degree
   names — and that education's *achievements* are a separate question, answered
   separately in F3.
7. ~~**M2** — certifications.~~ Done, reusing M3's gate wholesale as predicted.
8. ~~**F5** — duration.~~ Done as an honesty fix rather than a matching one.
   [ADR 033](../architecture/adr/033-what-the-matcher-cannot-represent.md).

### Still open

**The second half of F8.** An open-ended `experience` entry has no date to
check, so no gate notices a role that quietly ended. Closing it means either a
field that can go stale, which ADR 027 avoided on purpose, or parsing free-text
dates, which ADR 033 declines. Worth revisiting only with a third option.

**Efficacy, still unmeasured.** Part 3 names this as a trade rather than a gap,
and building all of the above has not changed it: every gate here is a negative
assertion about the build, and none is a positive assertion about an outcome.
`fit:audit` and `skills:gap` measure the corpus. Nothing measures whether any of
it got anyone hired, and nothing can without the collection mechanism this
project refuses to ship.
