# ADR 027: Free to serve, and the line the template will not cross

**Status:** Accepted · 2026-08-11

## Context

Someone forks this to put a portfolio online. They are not buying a platform;
they are looking for a job. A template that quietly attaches their work to a
metered resource has done something worse than charge them — it has charged
them by surprise, on an account they set up in a hurry, for a site they may not
look at again for months.

The asymmetry that makes this a design constraint rather than a preference:
**the person who merges a change here is not the person who pays for it.** One
binding added to a Function, one fetch to a paid API, and every adopter who
pulls the update inherits a bill they never agreed to and will not notice until
it arrives.

There is also a real temptation in the other direction. Standing up a
Cloudflare project, registering a domain, provisioning KV — an agent with the
adopter's credentials could do all of it in one run, and it would feel like
excellent service right up until the first invoice.

## Decision

**A site built from this template cannot bill its owner.** Not "is usually
cheap" — no metered resource is reachable, so there is no number to watch.

### The template hosts the site; it provisions nothing else

`/launch` takes a fork to a live GitHub Pages site and stops there. Pages on a
public repository, and Actions minutes for public repositories, are free and
unmetered — that is the whole reason it is the default target (ADR 020), not
merely a convenient one.

Everything beyond that is the adopter's own infrastructure, and the template
will help them use it but will never stand it up for them:

| The template will | The template will not |
|---|---|
| Enable Pages on a repo you own, building from the workflow | Create a Cloudflare account, project, or binding |
| Emit `dist/CNAME` for a domain you already own | Register a domain, or renew one |
| Read a `wrangler.toml` you wrote | Write one containing your account id |
| Explain what a paid plan would buy you | Enable a paid plan |

An adopter who wants `/api/fit`, `/api/mcp` and real response headers deploys to
Cloudflare Pages themselves. That is a deliberate step onto their own account,
taken knowingly — not something that happened while an agent was being helpful.

### Private repositories are refused, with the reason

`pages:setup` checks visibility before it enables anything and exits 2 —
**needs a human** — on a private repo. Two things stop being free there at once:
Pages requires a paid GitHub plan, and Actions minutes become billable, which
this repo's own CI would consume on every push since it installs Chromium and
builds.

Letting the API return a 403 would have been less code. It would also have told
the adopter *what* failed and not *why*, and the why is the entire point: the
choice between a public repo and a bill is theirs to make deliberately.

**It fails closed.** The first version only refused when `gh api` succeeded, so
an API error, an expired token, or a rename mid-run skipped the check and let
Pages be enabled anyway — the guard going quiet at precisely the moment nobody
knew whether it was needed. Unknown visibility is now treated as private.

### `free:check` asserts the boundary rather than trusting it

Wired in early in `npm test`, it fails on:

- a committed `wrangler.toml` — it carries account ids and live bindings;
- any reference from `functions/` to Workers AI, Vectorize, D1, R2, Queues,
  Durable Objects, Hyperdrive or Browser Rendering;
- a Function fetching an absolute `http(s)` URL, which is how a third-party
  paid API gets called on every request while looking like ordinary code;
- a deploy target that is not one of the two known-free hosts.

> KV is deliberately **not** on the metered list. The Fit quota counter holds a
> hashed IP and an integer, it sits inside the free tier, and it exists
> precisely to *cap* a cost surface. Banning the one binding whose job is to
> prevent spend would be cargo-culting the rule instead of applying it.

The gate is conservative by design — it will flag a commented-out `fetch` to a
paid host. That is the correct bias when the cost of a false negative lands on
someone else.

## Consequences

- The honest claim in the README is "free to run", and something enforces it.
- An adopter on the default path cannot be billed for their portfolio. The only
  routes to a bill are ones they walk deliberately: a domain, a paid plan, or a
  private repo — and the last one is refused with an explanation.
- Adding a genuinely metered feature later means changing this ADR and the
  gate, in a change whose whole subject is that decision. It cannot arrive as a
  side effect of a feature PR, which is the failure this prevents.
- The template stays useful to people who *do* have infrastructure: nothing
  here blocks Cloudflare, a custom domain, or a paid plan. It just refuses to
  arrange any of it on their behalf.
