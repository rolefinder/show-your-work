# ADR 019: Fit is a highlight, not an audit

**Status:** Accepted
**Date:** 2026-07-25

## Context

Fit shipped as a full audit. Every requirement extracted from a pasted job
description appeared in the brief, including ones with no supporting evidence,
marked `not_evidenced_on_site` or `missing`, plus a Gaps section listing them
back.

That is a defensible design for an internal self-assessment. It is the wrong
default for the surface a recruiter actually lands on. A portfolio is an
advocacy document: a résumé does not enumerate what its author cannot do, and a
project page does not close with a list of skills the author lacks. Handing a
recruiter a machine-generated list of your gaps, on your own site, is a
self-inflicted wound with no upside — they did not ask for it and no competing
candidate is volunteering one.

The owner asked for the dequalifying rows to go.

## The tension, stated honestly

ADR 017 fixed a bug where `extract.ts` silently dropped requirements before
evaluation, and the reasoning recorded there was that hiding a gap "makes the
candidate look like a BETTER fit than the evidence supports." That still holds
— for *that* bug. The distinction that makes this change different:

- **Dropping before evaluation** (the bug) is unpredictable and invisible. It
  depended on an arbitrary hardcoded keyword list, skewed the scoring of the
  rows that survived, and nobody — author or reader — could tell it happened.
- **Filtering the surface** (this ADR) is deliberate, total, and declared. The
  matcher still evaluates every requirement; the brief presents the subset it
  can support, and *says* that is what it is doing.

The second is only honest because of that last clause. A brief that omits rows
while presenting itself as a complete read of the JD would be worse than either
option. So the caveat text is not decoration here — it is the thing that keeps
the change defensible, and it is enforced by a test.

## Decision

1. **`FitMatchConfig.showGaps`**, default `false`. Tenant config, like every
   other Fit knob (ADR 016), rather than a value judgment welded into the
   engine — an adopter who wants the audit gets it with one line.
2. **Highlight mode (default)** returns only `aligned` and `partial`
   requirements and an empty `gaps` array. `missing` and
   `not_evidenced_on_site` are both dequalifying verdicts and both fed the Gaps
   list, so all three suppress together; removing only the status the owner
   named would have left the same information showing in two other places.
3. **The caveats change with the mode.** Highlight mode replaces "Absence of
   evidence is not proof of absence of skill" with "Shows the requirements
   covered by published work; it is not an exhaustive review of the role."
4. **The filter is applied at the surface, not in extraction.** Requirements
   are still extracted and scored in full. Filtering earlier would re-introduce
   the ADR 017 bug and would also change the relative scoring of the rows that
   remain.
5. **Empty-result copy.** A JD with no overlap now yields an empty brief, which
   renders as a broken tool. It says so plainly instead — factual, without
   volunteering a verdict on the candidate.

## Consequences

- The default brief is shorter and reads as a highlight reel. That is the
  intent.
- A recruiter cannot use the tool to enumerate gaps. They can still notice that
  a requirement they care about is absent, which is the same signal any
  portfolio gives.
- `fit-smoke` now asserts both directions: highlight mode never leaks a
  dequalifying status and always carries the non-exhaustive caveat; audit mode
  still produces unevidenced rows and a gaps list. The honest path stays
  available and tested rather than deleted.
- The README's "a requirement is never dropped" claim was true when written and
  is now false; it has been replaced rather than left to rot.
