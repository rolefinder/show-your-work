# ADR 033: What the matcher cannot represent — duration, and saying so

**Status:** Accepted · 2026-08-23

## Context

`DEFAULT_STOP` (`src/fit/config.ts`) contains `experience`, `experienced`,
`years` and `year`. That is correct for scoring: those tokens carry no topic,
and leaving them in would let every posting in the industry match every project.

The side effect is that the requirement

> 5+ years building delivery pipelines

tokenizes to roughly `{5+, building, delivery, pipelines}` and scores exactly
like "building delivery pipelines". One project about pipelines can therefore
return **aligned**, with a real citation, against a requirement the author may
not meet.

The citation is not wrong. It is evidence about the substance. What was wrong is
that nothing in the brief distinguished *"this person has published work about
pipelines"* from *"this person has five years of it"* — and a recruiter reading
a verdict column has every reason to assume the tool checked what the
requirement said.

This is a hole in the trust story rather than only an authoring inconvenience.
Cite-or-missing exists so a brief never asserts more than the corpus supports,
and here it was doing exactly that.

## Decision

**The matcher does not evaluate duration, and every place a duration appears now
says so.**

`statesDuration()` in `src/fit/match.ts` detects a length-of-experience phrase
in a requirement — digits or a spelled-out number against years/yrs/months, plus
"a decade". When one is found on a row that reached `aligned` or `partial`, two
things happen:

- the row's `why` gains a sentence naming the phrase in the author's own words:
  *Matched on substance only — "5+ years" is a length of time, which this
  matcher does not evaluate*;
- the brief gains one caveat, once, so a reader who scans verdicts and skips
  reasons still cannot come away thinking a duration was verified.

Nothing else changes. Scoring is untouched, the citation stays, and a brief with
no duration requirement carries no duration caveat.

### The status is deliberately not downgraded

Downgrading a duration row from `aligned` to `partial` was the obvious fix and
is the wrong one. It trades a false positive for a **false negative**, against
the author, in the one direction they cannot correct: someone with ten years of
pipeline work would be told their own site only partially covers a requirement
they comfortably exceed, and no amount of writing would fix it, because the
matcher still would not be reading time.

Under-claiming is this project's preferred failure mode, but only where the
corpus is genuinely silent. Here it is not silent — it just does not speak about
duration. The honest output is a complete answer about the part that was
evaluated plus an explicit statement about the part that was not.

### Why not compute the total from `experience`

`ExperienceItem.start` and `end` are free text, and ADR 027 promises the
template *"never parses or reformats a date it did not generate"*. "2023-04",
"2023", "Spring 2023" and "Mar 2023" are all valid values today. Summing them
would mean parsing them, which means guessing, and a guessed total presented as
a verified one is a worse version of the bug being fixed.

Roles also overlap, gaps exist, and "years building delivery pipelines" is not
"years employed" — the years a posting means are years doing the thing, which no
field on this site records. There is no honest total to compute.

### Why not a `years:` field per skill

It would be a self-assertion with no citation, which is the one kind of claim
this project refuses everywhere else. A number the author types is exactly the
resume bullet Fit exists to make checkable.

## Consequences

- One new caveat string, added only when earned.
- `fit-smoke` asserts both directions on a purpose-built corpus: a cited
  duration row must carry the sentence and the brief must carry the caveat, and
  a brief without a duration requirement must not. The fixture is synthetic
  rather than the demo corpus so the check cannot quietly stop asserting
  anything when demo content changes.
- The Worker path inherits this for free — `functions/_lib/fit-engine.js` is
  built from `src/fit/`, so there is no second implementation to keep in step.
- **This does not make the matcher able to represent time.** It makes it stop
  implying that it can. A requirement stating a duration remains something only
  the reader can settle, which is the correct place for it.
