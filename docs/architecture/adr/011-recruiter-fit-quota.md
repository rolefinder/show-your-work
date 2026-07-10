# ADR 011: Recruiter Fit ΓÇö quota and Request more

**Status:** Accepted  
**Date:** 2026-07-09

## Context

Fit calls burn Workers AI (and optionally Vectorize) quota. The site is a
public personal portfolio; unauthenticated visitors can paste JDs or script
the API. Harrison asked for a cheap product with a limit of **ΓÇ£10 queries
per week or 2 per dayΓÇ¥** plus a **Request more** button that uses a larger
model to decide whether granting extra quota is likely to help the
requester toward a job offer, with a cooldown.

Ambiguity: English ΓÇ£orΓÇ¥ might mean ΓÇ£whichever comes first,ΓÇ¥ ΓÇ£either plan,ΓÇ¥
or ΓÇ£pick one cap.ΓÇ¥ Product and ops need one enforceable rule.

See [`docs/strategy/recruiter-fit-prd.md`](../../strategy/recruiter-fit-prd.md)
and ADR 010 / ADR 012.

## Decision

### 1. Dual caps (AND, not OR)

Both limits apply to the same identity. A new Fit query is allowed only if:

- fewer than **2** successful Fit queries in the rolling **UTC day**, and
- fewer than **10** successful Fit queries in the rolling **UTC week**
  (Monday 00:00 UTC ΓåÆ next Monday, unless implementation picks a simpler
  7-day sliding window ΓÇö document the choice in code).

Hitting either cap blocks further Fit queries until that window allows
another. UI copy: ΓÇ£Up to 2 per day and 10 per week.ΓÇ¥

ΓÇ£OrΓÇ¥ in the original ask is interpreted as **two concurrent ceilings**
(common abuse pattern: stop daily burn *and* weekly burn), not as a choice
between two alternative plans.

### 2. What counts as a query

- Successful Fit responses count (HTTP 2xx with a brief).
- Validation failures (file too large, empty JD) do **not** count.
- Model/provider 5xx after the request was accepted **do** count if a
  billable inference ran; prefer failing closed on ambiguous billing.
- Request-more evaluations count as a **separate** billable action but
  do **not** consume Fit query quota (they have their own cooldown).

### 3. Identity

v1: bucket by **hashed IP + User-Agent salt** stored in Workers KV (or D1),
plus an optional client-issued opaque id in a first-party cookie if we add
one later. No login. Good enough for a personal site; not bulletproof
against distributed abuse (pair with WAF / Turnstile if needed).

### 4. Request more

- Shown when the user is at a Fit cap.
- Cooldown: **one Request-more attempt per identity per 7 days** (v1
  default; tunable).
- Flow: send a compact package to a **larger** Workers AI instruct model
  (or the highest-quality binding available on the free tier): recent JD
  truncated, prior Fit response summary, and a rubric.
- Rubric (normative intent): grant only if (a) the JD looks like a real
  hiring role, (b) prior briefs show genuine engagement with site
  evidence, and (c) more analysis could reasonably change a hiring
  decision. Deny scrapers, empty/gibberish JDs, and repeated
  near-duplicate JDs.
- On grant: add a small bonus (v1 default **+2 Fit queries** usable within
  7 days) without permanently raising the baseline caps.
- On deny: short reason; no grant. Copy must not promise a job offer.
- Log the decision (ADR 012).

### 5. Cost posture

Default path uses the smallest adequate Workers AI model for Fit. The
larger model runs only on Request-more. No paid Cloudflare plan is
required to ship; if free-tier AI limits are hit, fail with a clear
ΓÇ£temporarily unavailableΓÇ¥ rather than silently upgrading spend.

## Consequences

- Implementers must track two counters per identity (day + week) plus
  request-more cooldown and bonus balance.
- UI must explain dual caps to avoid ΓÇ£orΓÇ¥ confusion for recruiters.
- Distributed bots can still bypass IP hashing; ops doc must list
  Turnstile / tighter WAF as the escalation path
  (`docs/ops/bot-and-cost-protection.md`).
- Request-more is a judgment call by a model; false grants waste quota,
  false denies annoy real recruiters. Log and tune; Harrison can add a
  manual allowlist later if needed.

## Alternatives considered

- **Only 10/week OR only 2/day (single cap).** Rejected. Either alone
  allows a bad daily burn or a slow weekly scrape.
- **OR as ΓÇ£user picks a plan.ΓÇ¥** Rejected. Unnecessary product
  complexity for a portfolio tool.
- **Login / email gate for quota.** Deferred. Higher friction; revisit if
  abuse appears.
- **Unlimited Fit, rate-limit only at the edge (300 req/10s).** Rejected.
  Edge rule protects the zone, not Workers AI neuron spend.
- **Request-more always grants.** Rejected. Defeats the point of a
  judgment step and invites farming.
- **Paid credits / Stripe.** Out of scope for a personal recruiting aid.
