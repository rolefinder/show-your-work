# Review — an internship-system redesign, and what transfers

**Date:** 2026-08-20 · against `main` @ `5a34674`

**Source:** *MIS 306 Field Project Fall 2022 — Management Information Systems
Department Student Internship System Redesign*, San Diego State University.
A systems-analysis field project: document the current system with data flow
diagrams, diagnose it, propose a redesign, run a feasibility case.

Every finding below was reproduced against the real codebase or recomputed from
the document's own figures. Nothing here is inferred from reading alone. Where a
claim rests on the document rather than on this tree, it is quoted verbatim so it
can be checked.

**Extraction caveat.** The DFD images were drawn in Lucidchart and did not
survive text extraction; the Google Docs text export ends at page 79 of ~101.
What survived is every diagram's prose caption — each naming its processes,
sub-processes, entities and data stores — plus all body analysis. The missing
tail is diagram labels, exhibit tables, and works cited; the exhibit figures that
matter are quoted inline in the body. The process model below is reconstructed
from captions, and every place a caption is thin is marked as such.

---

## The shape of the problem

The document and this project diagnose the same failure independently, from
opposite sides of the table.

> "one of the biggest obstacles to connecting students to these internships is
> that MIS students are not easily narrowed down for recruiters compared to other
> majors. This leads to wasted time in the recruiting process… A symptom of this
> problem is that students are unsure of how to state the skills they learned
> from courses they have taken **or they say the same thing in different ways**
> on their resumes or profiles."

That is `README.md`'s "Most portfolios make a recruiter do the mapping," arrived
at by a different route and sourced from both sides of the market — the MIS
department chair wanting a filterable candidate pool, and a Career Management
Center adviser describing the intake failure.

The document also rules out scarcity as the cause, arithmetically: ~941 postings
against 490 students is roughly two openings each, and placement is 6.5%. Supply
is not the binding constraint. Something between supply and placement is failing.

**Then the treatments diverge completely, and the divergence is the whole review.**

| | The document | show-your-work |
|---|---|---|
| Bet | **Distribution** — make students findable inside a platform recruiters already use | **Evidence** — publish real work, let a deterministic matcher cite it |
| Fix for vocabulary mismatch | Change the *candidate's words* to match the recruiter's filter | Change the *retrieval* so the recruiter's words find the candidate's existing words |
| Unit of value | A filterable candidate list | A single-candidate cited brief |
| Verification | None anywhere | `aligned` requires ≥1 citation, enforced in `fit:smoke` |

The one-line summary of this review: **the document gets the diagnosis right and
the treatment backwards.** Its fix standardizes student self-description into the
employer's filter vocabulary. Ours puts the translation layer in the matcher
(`synonyms`, `extra_stops`, `skill_weights` in `content/config/fit.yaml`).

Ours is better on the axis this project cares about, for a precise reason: **a
translation layer in the matcher can be wrong without being a lie.** A bad
synonym mapping misses a match. A candidate who restates their work in someone
else's vocabulary to win a filter has made a claim they cannot cite.

That is the test applied to every idea below.

---

## Part 1 — What the document gets right

### I1. The vocabulary-mismatch diagnosis

**Verdict: adopt as a research finding. Costs nothing, breaks nothing.**

This survives every criticism in Part 5. It is a statement about *information*,
not about compliance, so it needs no institutional authority to transfer. It sits
upstream of the document's broken causal chain — deleting the retention, ranking
and budget links costs it nothing. And it gains the authors nothing rhetorically,
which is the one place in the document that is describing rather than selling.

**What it points at, concretely.** The `synonyms` layer is the surface this
finding implicates, and it currently ships empty: `content/demo/config/fit.yaml`
has `synonyms: {}`, and `DEFAULT_SYNONYMS` in `src/fit/config.ts` is nine generic
tech entries. If vocabulary mismatch is the failure mode recruiters actually
report — and this document is interview-sourced evidence that it is — then the
synonym layer is the highest-leverage under-invested surface in the matcher.

### I2. The reframing

**Verdict: already how we think. Worth recording as independent convergence.**

The best thinking in the document is a pivot away from the client's original ask.
The client — the department chair — wanted employers given "access to a database
with a robust search function." After stakeholder interviews the team concluded:

> "the problem is less about employers searching for students and more about
> **making students accessible for employers to find**."

Don't build a new destination; populate the one the audience already opens. That
instinct is sound, and it is why `llms.txt`, `llms-full.txt`, JSON-LD, `sitemap.xml`
and ADR 031's per-crawler policy exist here. The difference is transport
direction, and it is not a small one — see I15.

### I3. Recurrence as a first-class requirement

**Verdict: the sharpest idea in the document, and the one thing we genuinely lack.**

> "students who do use Handshake may not actively maintain and update their
> profile to accurately represent themselves. Without students maintaining an
> updated profile, employers have difficulty identifying the qualified candidate
> pool."

Their enforcement mechanism is institutional and untransferable (see I17). Their
*detection* insight is not: profile data decays, and a system that captures once
has already failed. We ship 18 gates and **not one measures time** (I11).

### I4. Baseline-and-target measurement discipline

**Verdict: adopt the practice, import none of the numbers.**

Every claim in the document carries a numerator, a denominator and a source:
32/490 students placed (6.5%), 941 openings (~2/student), 15,000/35,000 on
Handshake (43%), target 30%. The forecast shows its arithmetic — 16 weeks × 25
h/wk × $17.50 — which makes it *attackable*. That is the same instinct as
cite-or-missing, applied to a projection.

The numbers themselves do not survive contact (Part 5). The practice does, and it
exposes something about this project worth stating plainly:

**show-your-work has an excellent integrity metric and no efficacy metric at all.**
Every one of the 18 gates is a negative assertion about the build — the column
header in `README.md` says so: *"Refuses to ship."* PRD §14's success metrics are
all properties of the artifact: does it deploy, does it refuse to lie, how fast,
how cheap. Nobody in those metrics ever gets a callback. The document is the exact
inverse — an efficacy target with no integrity mechanism anywhere. Each is missing
precisely what the other has.

One consequence deserves naming as a *trade* rather than an oversight: `PRIVACY.md`
forbids analytics, the CSP blocks the beacon, and the JD never leaves the browser.
The default deployment is therefore **unmeasurable by construction**. That is
defensible and probably correct. It is still a choice, and reaching for the
document's metric frame would require breaking three commitments at once (I19).

---

## Part 2 — What this review found in *our* code

Mapping the document onto this tree surfaced eight defects. These are the real
deliverable. Five are live today, independent of anything we decide to import.

### I5. A bare skill label can satisfy the citation requirement

**Severity: critical** — this is the guarantee the whole project rests on.

`README.md` promises: *"`aligned` requires at least one citation. No claim, no
citation."* And `src/fit/match.ts:48-51` enforces it:

```ts
// Hard rule: aligned requires ≥1 citation
if (status === "aligned" && evidence.length < 1) {
  status = "not_evidenced_on_site";
```

But the *content* of that citation degrades to a bare label. `src/fit/index.ts:47`:

```ts
if (!skillQuote) skillQuote = doc.skillNotes?.[skillMatch] || skillMatch;
```

then `:60` — `const quote = claimQuote || skillQuote || snippetQuote;` — and `:66`
— `quote_or_skill: quote || doc.skills[0] || doc.title`.

**Repro (arithmetic, from shipped defaults).** `skill: 14` and `alignedMin: 20`
in `src/fit/config.ts:91-96`. Two skill-term matches score **28 ≥ 20 → `aligned`**.
If the adopter wrote no `skill_notes`, the "citation" rendered to the recruiter is
the bare word `TypeScript`.

**And the default new-adopter state is the exposed one:** `scripts/init-site.mjs:271`
scaffolds `skill_notes: {}`.

The code already knows the hierarchy — the comment at the same site reads *"a whole
authored claim (outcome / evidence bullet) reads as a citation; a skill tag is a
label."* It is correctly understood and correctly ordered; the threshold simply
permits the label to clear the bar.

**Decision needed, independent of this document:** should a label-only citation be
capable of reaching `aligned`? The document's skill-checkbox idea is exactly what
would industrialize this seam, which is how it was found — but the seam is ours
and it is open now.

### I6. `decisions` scores but cannot be quoted

**Severity: medium** · cheap fix

`src/fit/evidence.ts:27` builds claims from work as:

```ts
const claims = [w.outcome, ...(w.evidence || [])]
```

`w.decisions` is concatenated into `doc.text` at `:35` but never enters `claims`
at `:39`. So a project's best-reasoned sentences are matchable but only citable as
a 160-character `snippetAround()` window, cut mid-sentence.

For a student writing up a class project, `decisions` is often where the actual
engineering judgement lives.

### I7. Education is structurally uncitable, and the ADR's reasoning does not cover the gap

**Severity: high for the early-career persona**

`buildEvidencePack` (`src/fit/evidence.ts`) loops exactly four kinds — `about`,
`work`, `blog`, `experience`. `grep education src/fit/` returns nothing.
`functions/api/mcp.ts:106` lists the same four.

The asymmetry against experience is total:

| | `skills` | `projects` | evidence pack | skill bank | graph |
|---|---|---|---|---|---|
| work | ✅ | — | ✅ | ✅ | ✅ |
| blog | ✅ | — | ✅ | ✅ | ✅ |
| experience | ✅ | ✅ | ✅ | ❌ | ❌ |
| **education** | **❌** | **❌** | **❌** | **❌** | **❌** |

`EducationItem` (`src/types.ts:119-127`) has no `skills` and no `projects`, while
`ExperienceItem` has both (`:110`, `:114`).

ADR 027 justifies the exclusion: *"'BS, Information Systems' is not evidence… and
adding it would mostly produce degree-name keyword collisions."* That reasoning is
sound **for degree names**. It does not cover `achievements[]`, which holds whole
authored sentences — the demo's own:

> `- Capstone built a fictional content pipeline that a department actually used.`

That is structurally identical to a `work.evidence` bullet, has none of the
collision property the ADR objects to, renders on `/experience`, and is citable by
nothing.

### I8. The matcher cannot represent duration

**Severity: medium** — a hole in the trust story, not just a student question

`DEFAULT_STOP` (`src/fit/config.ts:70`) contains `experience`, `experienced`,
`years`, `year`. So "5+ years building delivery pipelines" tokenizes to roughly
`{5+, building, delivery, pipelines}`, and a single class project about pipelines
can return `aligned` against it.

This is sharpened by ADR 027's own motivation for adding `experience`: *"A
requirement like '5+ years building delivery pipelines' was matched against project
pages, because project pages were all there was."* Adding the corpus gave the
matcher better documents to cite. It did not give it the ability to represent
duration — so a brief can still return `aligned`, with a real citation, against a
requirement the candidate cannot possibly meet.

### I9. Two of four descriptions of our flagship vocabulary rule are inverted

**Severity: medium** (documented contract contradicts the code)

`scripts/check-content.py` **blocks** on near-duplicate skills — it appends to
`errors`, not `warnings`:

```python
errors.append(
    f"content/: skill spelled {len(variants)} ways - {listed}. "
```

`README.md` and `ARCHITECTURE.md` describe this correctly. Two other places do not:

- `scripts/check-content.py:18` — its own docstring — says *"Blocks on (1) and (3)…
  **Warns on (2)**, because a genuinely new skill is legitimate."*
- `docs/guide/authoring.md:196` — *"`check-content` **warns** on near-duplicate
  labels rather than blocking"*, repeated in its table at `:231-233`.

The gate is the repo's implementation of this document's central insight, and half
its documentation says it does the opposite of what it does.

### I10. The demo corpus ships the fragmentation the gate exists to prevent

**Severity: medium**

The gate normalizes by stripping non-`[a-z0-9]` and lowercasing, so it catches
`TypeScript` / `Typescript` but not semantic variants. The shipped demo carries
three overlapping labels, passing green:

```
pipelines                content/demo/work/fake-project-merge-gate.yaml:17
content pipelines        content/demo/work/fake-project-content-emit.yaml:14
YAML content pipelines   content/demo/about/profile.yaml:15
```

Three chips, three graph nodes, three search entries, three skill-weight buckets —
in the corpus that models good practice for every adopter.

Related: `src/app.tsx:431` passes only `[...visibleWork, ...visibleBlog]` to
`collectSkillCounts`, so experience and profile skills never reach the skill bank
even though `check-content` gates them. And `scripts/skills.mjs` scans work + blog
+ profile only, so the advisory tool and the blocking gate disagree about scope.

### I11. No gate measures time

**Severity: medium** · this is I3, as a finding

The 18 gates in `package.json` are all structural. Nothing notices that `content/`
has gone stale: a `work` entry dated `2026-06` stays published and citable in 2029,
and Fit quotes it with identical confidence.

ADR 027 frames the open-ended `experience` entry as a feature — *"There is no field
to leave stale, so a role cannot claim to have ended when it did not."* True of the
*display*, and precisely inverted for *truth*: an absent `end:` is the one field
that silently becomes a lie.

### I12. Fit computes the author's to-do list and then discards it

**Severity: high** — highest-value opportunity in this review

`matchFit` evaluates **every** extracted requirement and assigns `missing` /
`not_evidenced_on_site` — a literal, ranked list of what the adopter should go
write. Then all three paths destroy it:

- highlight mode (`show_gaps: false`, the default) filters those rows out of the
  returned brief;
- the browser path never transmits them (`PRIVACY.md`: *"Close the tab and it is
  gone"*);
- `/api/fit` stores nothing.

The information is generated and destroyed on every run. **No file in the repo
turns it toward the author.** This is the return edge the document's DFD has and we
do not — and closing it needs no new matching logic and no change to the privacy
posture, because it never involves a visitor.

---

## Part 3 — What to build

Three proposals, in dependency order. Each is checked against ADR 028 (`free:check`),
ADR 021 (additive), ADR 016 (identity is data), ADR 010 (no model in the matching
path), and the no-invention rule.

### P1. `bun run fit:audit` — turn the discarded signal toward the author

Closes I12. An offline command that runs local JD fixtures (shipped, plus any the
adopter saves) against the local corpus and prints coverage:

```
19 requirements · 6 aligned · 4 partial · 9 uncited
uncited: "experience with container orchestration"
         "familiarity with incident response"
```

Reuses `matchFit` with `showGaps: true` — zero new engine. Local file reads only,
no network, no binding, no beacon. Gives the adopter exactly the
baseline-and-target number I4 says we lack, at zero cost to `PRIVACY.md`.

Fits alongside `check-ready.mjs`, which already has the right shape
(blockers/warnings/`--json`).

### P2. Staleness as a `check-ready` warning

Closes I11. `check-ready.mjs` already separates blockers (exit 1) from warnings,
and ADR 018 sets the precedent: *"Missing Playwright and missing `outcome`/`evidence`
are warnings, because both produce a working site, just a worse one."* A stale
corpus is that class.

Optional key in `content/config/site.yaml`:

```yaml
freshness:
  stale_after_days: 365
```

**Implementation trap worth naming:** read the `date:` scalar out of the YAML, not
filesystem mtime and not git history. A fresh clone rewrites every mtime and CI
shallow-clones lose history — either would report "everything is stale" on a clean
checkout.

### P3. `content/courses/` — coursework as gate-checked provenance

Closes the I7 gap for the population most likely to fork a portfolio template.
The design rule is what makes it safe:

> **A course may only claim a skill that one of its own linked projects already claims.**

Consequences that fall out for free: courses add **no** new labels to the
vocabulary, and **no** new documents to the evidence pack — so ADR 027's collision
hazard is structurally impossible rather than merely mitigated, `emit-evidence.py`
and `fit-smoke`'s parity assertion are untouched, and no Fit citation can ever
point at a course. A course cannot appear at all unless it produced something
published. *Show your work*, applied to coursework.

```yaml
slug: mis-315-database-systems
code: MIS 315
title: Database Management Systems
term: "Fall 2021"
# Each skill must also appear on a linked project. The gate enforces it.
skills: [SQL, data modelling]
takeaway: >
  Normalised a 14-table advising schema to third normal form and wrote the
  migration that moved 40,000 rows onto it without dropping a session.
projects: [advising-schema-migration]
visible: true
```

The gate is four rules in `check-content.py`, three copy-pasted from existing
loops; the fourth asserts the subset rule. Add one line to `fit-smoke.ts` asserting
courses never enter the evidence pack — the safety property should be asserted, not
assumed.

**This is the SDSU claim upgraded.** There, the department asserts the skill. Here,
the build refuses to publish the claim unless a linked artifact already
demonstrates it.

### Smaller fixes

- **I5** — decide whether a label-only citation may reach `aligned`. Do this first;
  it is the only critical item.
- **I6** — add `w.decisions` to `claims`. One line, plus the same change in
  `scripts/emit-evidence.py` or `fit:smoke` fails.
- **I7** — let `education.achievements[]` into the pack as `claims` while keeping
  `institution`/`credential` out of the text. Respects ADR 027's actual objection.
- **I9** — fix the docstring and `authoring.md`.
- **I10** — resolve the demo's three pipeline labels; widen `skills.mjs` to match
  the gate's scope.

---

## Part 4 — What not to import

### I13. The four-product commercial stack — reject

$1,334/month recurring (`876 + 340 + 100 + 18`, verified) against ADR 028. But
price is the least of it: four vendors in the critical path of a static personal
site means four pricing changes, four ToS surfaces, four deprecation risks.

The due diligence is also unreliable. The section whose job is establishing these
vendors are trustworthy says *"Microsoft SQL Server and Microsoft Power Automate,
are long-standing robust software that have been around for over 45 years"* —
Power Automate shipped in 2016. Zapier is *"able to connect up to 5,000 different
web applications"* in one section and *"over 1000 application connections"* two
pages later.

**Note what the middle tier is actually for.** Zapier + SQL Server are $1,216 of
the $1,334 (91%), and they exist *only* because the other components are different
vendors' SaaS. In a single-repo build system that tier disappears: `content/*.yaml`
→ `emit-content.py` → `src/generated/content.ts` is stages 4–5, at build time, for
$0.

### I14. The graded mandate — reject, and note what it proves

> "making it worth a small percentage of their grade in all their MIS courses,
> somewhere around 2-5%, and the survey will be mandated each semester"

There is no analogue: nobody has authority over someone who forked a repository.
The only lever a template has is the build, and the build is the wrong instrument —
our gates enforce truthfulness and internal consistency, never volume. Importing
the coercion frame produces gates that demand content ("your site must have N
projects"), and the failure mode is expensive: **teaching adopters that gates are
obstacles to be silenced trains them to reach for `--skip`, and the next gate they
silence is `fit:smoke`.**

**But the mandate proves something worth keeping.** The document states Handshake
already has the capability — *"Handshake is capable of allowing employers to search
for students but students aren't using the platform effectively"* — and students
can already type into their own profile. So the entire four-product stack exists to
move data into a platform the student could have filled in directly. **The stack's
value-add is not capability; it is compulsion.** On the document's own analysis the
effect is caused by the free mandate and the $20,008/year of software is severable.

The test for any future proposal from this document: *is this the mandate, or is it
decoration around the mandate?*

### I15. Auto-populating a third-party profile — reject as a write path

Three independent failures:

- **`free:check`** flags a Function fetching an absolute URL, with the comment
  *"A Function reaching a third-party host is the classic cost leak."*
- **AGENTS.md, absolute:** *"Never handle a credential."* Writing to someone's
  Handshake or LinkedIn requires exactly that.
- **The PRD already adjudicated this and ruled the other way** (§8): scrapers are
  *"out of supported scope"*; the supported path is the member-initiated export ZIP
  with a deterministic parser and *"diff + confirm before write."*

The data direction is the deepest objection. We **pull** into content the adopter
reviews before it publishes. The document **pushes** into a platform with no review
step — which makes the adopter's public self-representation a *build artifact*
rather than something they wrote. And the ToS exposure lands on an individual's
personal account. A template that gets someone's account restricted while they are
job-hunting has done them a specific, serious harm.

**The goal is transferable if you invert the transport, and we already do it.**
`/api/mcp` (ADR 024/030) is the honest version: instead of the site writing into a
recruiter's tool, the recruiter's agent reads the site — `list_pages`, `get_page`,
`fit_brief` over `evidence.json`. Same end state, no credential, no partner
agreement, no invoice.

**Explicitly do not build:** a scheduled Action pushing profile updates into
LinkedIn or Handshake. Stored credential, third-party fetch, and — on a private
repo — billable Actions minutes, which is ADR 028's own worked example.

### I16. Centralized storage of personal data — reject

> "set up the SQL server database to store all the data from students securely so
> that it can be managed by SDSU administrators and **also accessed by potential
> employers**"

Held: photos, bios, work history, education, coursework, resumes, "skills and
personal information," for 490 students, compelled under academic penalty. The
safeguard supplied is the word *"securely"* — that is the entire privacy analysis
in a ~10,500-word report. No access-control model, no retention policy, no consent
mechanism, no mention of FERPA despite course history being an education record.

For us this would break the no-server posture, fail `free:check` (D1 is in
`METERED_BINDINGS`), and require `PRIVACY.md` to be **rewritten, not patched** —
the file already says exactly this about smaller changes. It would also create the
one thing our architecture currently makes impossible: **a breach.** There is no
database to leak. That property is worth more than any feature on offer here.

### I17. The context collapse

Nine ideas depend on institutional authority. The ones that matter:

| Idea | Silently requires | Why it fails in a fork |
|---|---|---|
| Graded mandate | Power to impose academic penalty | No lever exists; the build is the wrong instrument (I14) |
| Semester cadence | A shared institutional calendar | A static site has no cron. An individual's cadence is event-driven ("I shipped something"), not calendar-driven |
| Premade skill dropdowns | One shared curriculum and catalog | Adopters share none. `skills.yaml` says so: *"Adopters replace this file — core never hardcodes a person-specific map"* |
| Employer-side filters | Ability to change a vendor's search UI | SDSU is Handshake's *customer*. **The entire employer-side benefit case depends on a change to someone else's product that nobody agreed to** |
| A marketplace recruiters browse | A paid platform with an employer-side audience | The deepest gap. The document optimizes discoverability *inside a marketplace*; we optimize credibility *inside a document you hand someone*. Tactics tuned for the first — fill more fields, match the filter vocabulary — actively damage the second |
| Career Center resume review | Salaried expert labor, free | The only substitute is an LLM reviewer — the exact thing we exclude, and the precise vector by which invented content would enter `content/` |

The sentence that best captures it: *"creating a way for students to **have to** use
Handshake would be beneficial."* "Have to" is the mechanism, and it is the one thing
that does not survive the move to a forked template.

**A related structural point worth recording.** Half the document's process model
is unreachable for us *by construction, not by omission*. Processes 3.0–6.0
(application, feedback, interview, offer) each require durable two-party state, and
`scripts/check-free.mjs:32` bans D1, R2, Durable Objects, Queues, Vectorize, Workers
AI, Hyperdrive and Browser Rendering outright. That turns "we don't do applications"
from a gap into a derived consequence of ADR 028 — a better answer than we
currently give.

### I18. The branding frame — reject, and watch three specific seams

The document's vocabulary: *"create their brand"*, *"personal branding toolbelt"*,
*"help them stand out"*, *"less on making their resume/profile look perfect."* That
frame optimizes **presentation**; we optimize **provability**.

The general rule this yields, worth keeping as a test:

> **Any change that makes a site more complete without the adopter writing more is
> a change that makes it less true.**

Three seams to watch:

1. **Auto-populate as an entry point for generated prose.** The pull is to read a
   `TODO:` as friction to be removed. It is the opposite: the `TODO` *is* the
   no-invention guarantee, expressed as a build failure.
2. **Tailoring inverts the data flow.** The document's process 2.3 has the student
   *"tailoring your resume for the job description."* Import that and the JD gains
   influence over what the page says — and the JD is untrusted input (Fit PRD §8).
   The current architecture makes that impossible; it should stay impossible.
3. **Highlight mode is the nearest miss.** `README.md` already says *"a portfolio is
   advocacy, not a self-assessment."* Highlight mode is defensible **only** because
   every highlighted row is cited. The failure mode to watch: a future change admits
   an uncited row on advocacy grounds. It would not look like a policy change — it
   would look like a UX improvement. `show_gaps` is a *display* setting; the citation
   rule is a *truth* rule, and no argument for the first is ever an argument about
   the second.

The document contains the tell that it lost this thread itself: employers get *"a
larger candidate pool, filled with higher quality candidates (since we are removing
the barrier to entry)"* — and two paragraphs later the same benefit is *"eliminating
unqualified students."* Removing a filter cannot raise the mean quality of what
passes it. That is what happens when "help people present themselves better" goes
unexamined: volume gets narrated as quality.

### I19. The metric frame arrives with its own plumbing

Measuring success in placements requires knowing how many recruiters ran Fit —
which requires analytics, which `PRIVACY.md` forbids, the CSP blocks, and the
browser-local matcher makes structurally unobservable. The metric is
architecturally unreachable, and reaching for it means breaking three commitments
at once. Adopting a frame is never just adopting an attitude; a frame comes with
the plumbing it needs, and the plumbing is where the damage lands.

P1 (`fit:audit`) is the version that gets the benefit without the plumbing: it
measures the corpus, not the visitor.

---

## Part 5 — The business case

**Reuse no figure from this document.** Every headline number was recomputed.

**What checks out:** the recurring sum (`876+340+100+18 = 1,334`); the per-internship
wage (`16 × 25 × 17.50 = $7,000`); and the baselines (32/490 = 6.53%, 15,000/35,000
= 43%, $2.5M/$22.5M = 11.1%).

**What does not:**

| Claim | Recomputed |
|---|---|
| ROI "over 223%" | `(298,839 − 1,334) / 1,334` = **223.02**. They computed a *ratio of 223×* and appended a percent sign. The true figure on their own inputs is ~22,302%. The $4,000 setup is excluded from the denominator entirely |
| NPV $2,694,264 | `298,839 × 12 ÷ 1.10³` = **$2,694,265.97** — within $2. So the formula is: one year of **gross** benefit, discounted three years, **with zero costs subtracted**. An NPV with no outflows in it is not an NPV |
| EV $298,839/month | ÷ $7,000 = 42.7/month = **512 internships/year in a 490-student department** — more than 100% of the major, against a 30% target. At their own target the figure is $85,750/month, 3.5× lower |
| "increase of over 450%" | 6.5% → 30% is 4.62×, an increase of **362%**. Same error class as the ROI, in the document's other headline number |
| Zapier $340/month | = $4,080/yr, against the document's own stated ceiling of **$800/yr** — 5× its own research |
| Retention 39% → 25% | Needs ~907 more SDSU graduates to stay each year. Retaining **every** MIS graduate who would otherwise leave is ~48 people — **5%** of the required effect, at 100% efficacy, on the friendlier denominator |

**The category error underneath all of it.** The $298,839 is *"in terms of students'
wages"* — paid by employers to students. The costs fall on the university. So the
university's cash return is **$0**; students receive the entire benefit and pay
nothing priced; employers pay the $3.6M and their wage outlay is counted as a
*benefit of the system*. An ROI dividing a third party's income by a second party's
costs is not an ROI. And *"the payback period was immediate"* cannot be payback when
no payment is ever received — which the document then contradicts in the same
sentence: *"immediate upon implementation… which could take around 6 months."*

**Costs named and then dropped:** developer labor (*"one to two semesters"* of a
team, inside a $4,000 setup line); *"various variable overhead costs such as database
management and employee salaries"*, named and never quantified; and Handshake
licensing — the first item on their own implementation checklist, priced at $0.

**The 30% target is justified by one self-refuting sentence.** *"There are currently
about 940 opportunities open to MIS students… about 2 opportunities per student. For
this reason, we think our target is feasible."* Those postings and those students
exist **now**, and placement is **now** 6.5%. If posting supply were binding,
placement would already be high. The only cited evidence for feasibility concerns a
resource the document's own data shows is not the constraint. It also treats
listings visible to SDSU students as slots reserved for them.

**The alternative never tested.** The document's own root-cause evidence is an
awareness problem — the Career Management Center adviser reports that teaching
students Handshake exists *"is often the first time they have heard of it."* A
department email, or a graded ten-minute in-class "claim and complete your profile"
assignment, delivers most of the mechanism at **$0/month**, on day one rather than
in six months. It is never compared against $20,008/year.

**What survives:** the diagnosis (I1), the reframing (I2), the recurrence insight
(I3), and the measurement *practice* (I4). Nothing financial.

---

## Sequencing

1. **I5** — decide whether a label-only citation may reach `aligned`. Only critical
   item; everything else can wait behind it.
2. **I6, I9, I10** — one-line fixes and doc corrections. Clear the deck.
3. **P1 `fit:audit`** — highest value per unit of work; no new engine, no privacy cost.
4. **I7** — `education.achievements[]` into the pack as claims. Small, unlocks the
   early-career persona.
5. **P2 staleness warning** — needs an ADR only if `site.yaml` gains the key.
6. **P3 `content/courses/`** — the largest piece; needs its own ADR, which must
   record that it deliberately does *not* revisit ADR 027's exclusion of education
   from the pack.
7. **I8** — duration is a design question, not a fix. Worth an ADR of its own about
   what the matcher can and cannot represent, and whether a brief should say so.
