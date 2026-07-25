---
name: sanitize
description: Find employer-internal detail in a recruit-me site before it is published — codenames, client names, internal hostnames, ticket prefixes, team structure — and set up a guard so it cannot reappear. Use when the user runs /sanitize, or asks to "check what I'm about to publish", "did I leak anything", "review this for confidential info", or before making a portfolio public.
---

# /sanitize

A portfolio describes work you did somewhere. The line between "what I built"
and "what my employer's internals look like" is real, and it is easy to cross
in a sentence that reads perfectly well.

This finds the crossings, then makes them un-repeatable.

**Judgement, not a regex sweep.** A script cannot tell a public product name
from an internal codename. You can, by asking one question per candidate:
*would this appear in a press release, or only in a wiki behind SSO?*

## 1. What actually ships

```bash
npm run build
```

Scan `dist/`, not just `content/` — `dist/` is the published artifact, and it
contains prerendered documents, `evidence.json`, `llms.txt` and the OG card
text. A term can reach it through a Fit quote or a JSON-LD field without ever
looking wrong in the YAML you wrote.

## 2. Read for the five categories

Go through `content/work/*.yaml` and `content/blog/*.yaml`. These are what a
recruiter reads, and `outcome` / `evidence` are what Fit quotes verbatim.

| Category | Looks like | Why it leaks |
|---|---|---|
| **Codenames** | `project-nightingale`, `atlas-v2`, `orchard` | Names an internal system. Often maps to a team, a roadmap, or an acquisition |
| **Clients and partners** | a named customer, an unannounced vendor | Frequently under NDA, and not yours to disclose |
| **Internal topology** | hostnames, repo paths, dashboard URLs, queue names, index names | A map of the estate. Useless to a recruiter, useful to an attacker |
| **Identifiers** | ticket prefixes (`DATA-1234`), incident numbers, PR links to private repos | Confirms tooling and often resolves to real content |
| **People and structure** | colleagues' names, team sizes, reorg detail, headcount | Not yours to publish, and rarely load-bearing for the claim |

Also watch for **unannounced facts** — a product not launched yet, a migration
in flight, a number that was never made public. Those are the ones that cause
real trouble, and no pattern finds them.

## 3. Rewrite, do not redact

The claim is usually fine; the specificity is the problem. Keep the outcome,
drop the proper noun:

> **Before** — "Cut p95 latency on `atlas-v2` from 800ms to 340ms by moving
> the Vendorly token exchange behind a Gatekeeper rate limiter."
>
> **After** — "Cut p95 latency on an internal identity service from 800ms to
> 340ms by moving token exchange behind a rate limiter."

The measurement survived. The estate map did not. **Do not delete the
evidence** — a project with no `outcome` or `evidence` makes Fit quote prose
fragments instead of whole claims, which is a worse portfolio.

If a number itself was never public, replace it with a shape you can defend:
"roughly halved p95" instead of an exact figure from an internal dashboard.

## 4. Make it un-repeatable

```bash
npm run publication:check
```

Fails if anything on your guarded list appears in `content/` or `dist/`.
Wire it into your own habits — it is already in `npm test`.

Three places to declare a term, and **the choice matters**:

| Where | Committed? | For |
|---|---|---|
| `content/config/corpus-guard.yaml` → `never_publish:` | **yes** | Terms that are not themselves secret — an employer's public name you just do not want on a personal site |
| `content/config/corpus-guard.local.yaml` | **no**, gitignored | Anything you would not want a reader of your repository to see |
| `$RM_GUARD_TERMS` (comma-separated) | n/a | The local file's form for CI. Feed it from a repository secret |

> **The list is not a hiding place.** Writing `project-nightingale` into a
> committed file publishes `project-nightingale` — to anyone browsing the repo
> that hosts your site. That is why the local file exists, and why it is
> gitignored rather than merely discouraged. If a term is sensitive, it does
> not go in a file you push.

## 5. Verify against the artifact

```bash
npm run build && npm run publication:check
npm test
```

Then paste a real job description at `/fit` and read the brief. Fit quotes
`outcome` and `evidence` verbatim, so it is the fastest way to see what a
recruiter will actually be shown — and the fastest way to notice that a
sanitized sentence now reads as vague.

> The examples above are invented. Writing a *real* codename into a skill, a
> doc, or a guard list publishes it — which is the mistake this whole page
> exists to prevent, and one this file made in its first draft.

## Constraints

- **Never weaken the list to make the check pass.** If
  `publication:check` fails, rewrite the sentence. Removing the term is how
  the leak ships.
- **Never invent a replacement fact.** "an internal identity service" is a
  generalisation of something true. "a service handling 2M requests/day" when
  you no longer remember the figure is a fabrication, and this project's whole
  claim is that every published statement is real.
- **Do not scan `content/demo/`.** `corpus:check` owns that direction — it
  keeps the shipped demo free of *real* identity, which is the opposite job.
- If the user is unsure whether something is disclosable, say so plainly and
  let them decide. Do not rule on their employer's policy for them.
