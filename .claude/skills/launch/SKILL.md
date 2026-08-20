---
name: launch
description: Take someone from a fresh show-your-work fork to a live site end to end — gather their identity in one pass, scaffold the config, draft and build the site, and publish it to GitHub Pages. Runs autonomously between a single up-front authorization and the final URL. Use when the user runs /launch, or asks to "set up my site", "get me a portfolio", "put my site online", or "do the whole thing for me".
disable-model-invocation: true
---

# /launch

Fork to live site, in one run. `/build-show-your-work` produces `dist/`;
`/deploy-pages` covers Cloudflare. This is the whole path, and it is the one
to use when the user wants the work done rather than explained.

**Shape of the run:** ask everything you need at the start, take one
authorization before anything leaves the machine, then do not interrupt again
until you have a URL or a genuine blocker.

## What you may never do

These are not preferences.

- **Never type a password, a token, or a 2FA code.** Not into a browser, not
  into a prompt, not into a config file. Authentication happens in the user's
  own terminal via `gh auth login`. `pages:setup` exits `2` and prints the
  exact command when that is needed — relay it and wait.
- **Never invent content.** Not an employer, a date, a metric, a team size, an
  outcome. If a source does not say it, it becomes `TODO:` for the human. This
  is the product: a Fit brief is trustworthy only because every quote is real
  text from a page that really exists.
- **Never publish an unreviewed draft.** Drafting writes `visible: false`. Only
  the human flips it.
- **Never edit `src/`** to make something work. If a step seems to need it,
  that is a template bug — report it.

## 1. Gather identity — one pass

Use **AskUserQuestion**, batched. Do not trickle these out one at a time; the
whole point is that the user answers once and then leaves.

Required: name · tagline · location · email · site origin · a short summary.
Optional: GitHub, LinkedIn, YouTube, personal site, accent color.

Two questions decide the deploy shape, so ask them here rather than at the end:

- **Where should this live?** A `<username>.github.io` repository, or a custom
  domain they already own. show-your-work serves at the **root only** — asset paths
  are absolute — so a project site at `username.github.io/some-repo/` would
  load blank. `check-pages-target` enforces this; do not try to work around it.
- **Does the repository exist yet?** If not, you will create it in step 3.

Set `origin` from the answer: `https://<username>.github.io` or
`https://<their-domain>`. `init` derives `deploy.custom_domain` from it, so do
not ask for the same host twice.

Write the answers to a JSON file and run it non-interactively — the prompt path
exists for humans:

```bash
node scripts/init-site.mjs --config /path/to/me.json --dry-run   # look first
node scripts/init-site.mjs --config /path/to/me.json
```

Keys are the field names above, plus an optional free-form `links` map for any
platform, and `deploy_target` (`github-pages` by default, `cloudflare-pages` if
they said so).

## 2. Content, then build

```bash
node scripts/check-ready.mjs --json
```

`--json` so you branch on structure, not on parsed prose: `exit` is `0` ready,
`1` config still has placeholders (each listed in `blockers`), `2` a toolchain
dependency is missing (`missingDependencies`).

If there are blockers, they are all things only the user can answer. Do not
guess past them.

For content: follow `/build-show-your-work` steps 2–4 — draft from
`content/config/sources.yaml` if the user asked for it, then `bun run test`, then
verify the artifact rather than trusting the exit code.

**Report ungrounded claims prominently.** They are the drafting workflow
catching itself inventing, and they are the one output the human must act on.

## 3. Authorization — the single gate

Before anything leaves the machine, state plainly what you are about to do and
get one explicit yes. Name the repository, its visibility, and each action:

> I'm ready to publish. This will:
> 1. create the **public** repository `octocat/octocat.github.io`
> 2. push this site to its `main` branch
> 3. enable GitHub Pages on it, building from the workflow in this repo
> 4. wait for the deploy and give you the URL
>
> The repo will be public — that is required for Pages on a free account.
> Shall I go ahead?

Three things this must get right:

- **Public is a real decision.** GitHub Pages requires a public repository on
  free accounts. The user's YAML becomes world-readable. Say it in those words;
  do not bury it.
- **This path is free, and you must keep it that way.** Public Pages and public
  Actions minutes cost nothing. Do not offer to set up Cloudflare, register a
  domain, or enable a paid plan to get past a problem — none of that is yours to
  arrange, and a bill that arrives because an agent was being helpful is worse
  than a site that is not up yet. Name the option, stop, let them decide
  ([ADR 028](../../../docs/architecture/adr/028-free-to-serve.md)).
  `pages:setup` refuses a private repo for the same reason and says why.
- **After the yes, do not ask again.** Steps 4–6 run without further prompts.
  Come back only for a blocker you genuinely cannot resolve.

## 4. Publish

```bash
bun run pages:setup --dry-run --json   # what it would do, changes nothing
bun run pages:setup --json
```

It checks `gh` is installed and authenticated with the `repo` and `workflow`
scopes, resolves the repository, refuses if the site would land on a subpath,
then enables Pages with the workflow as the build source. Idempotent.

Exit codes are the contract: `0` configured · `1` failed · `2` needs the human,
with `reason` and `action` in the JSON. On `2`, relay the `action` verbatim and
stop — every case of `2` is something only they can do.

If the repository does not exist yet, create it first with the name from step 1:

```bash
gh repo create <owner>/<owner>.github.io --public --source=. --remote=origin --push
```

Otherwise push normally. The `deploy-github-pages` workflow triggers on `main`.

## 5. Watch it, then verify the live site

```bash
gh run watch --exit-status
```

The workflow builds with `PRERENDER_REQUIRED=1`, so a missing browser fails the
deploy instead of silently shipping an SPA-only site. It also re-runs
`config:check`, `seo:smoke`, `fit:smoke` and `pages:check` against the exact
commit being published.

When it is green, fetch the live URL and confirm what actually shipped — a
green workflow means it deployed, not that it is right:

- the home page `<title>` is their name
- a project route serves its own `<title>` and `<link rel="canonical">`
- `/fit` loads and a brief cites a real project
- no CSP violations in the console

## 6. Report

Give them the URL first. Then:

- what still needs them: `TODO:` markers, ungrounded claims, drafts left at
  `visible: false`
- **what they gave up by choosing GitHub Pages**, in one line rather than
  buried: no `frame-ancestors` (the CSP is a `<meta>` tag, because Pages cannot
  set response headers), no HSTS, no `/api/fit`. `/deploy-pages` moves them to
  Cloudflare if they want those. See `docs/guide/deploy.md`.
- a custom domain, if they set one: the CNAME is emitted, but the DNS record
  is theirs to add — name the exact record.

## Failure modes worth knowing

| Symptom | Cause |
|---|---|
| Live page loads blank | Site is on a subpath. `pages:check` should have caught it; if it did not, the repo was renamed after setup |
| Every route shows the home page's title | Prerendering did not run. Should be impossible in the workflow — `PRERENDER_REQUIRED=1` is set |
| `403` from `pages:setup` | Token lacks `repo`, or the user is not an admin of the repo. The JSON `action` says which |
| Push rejected on `.github/workflows/` | Token lacks the `workflow` scope. `gh auth refresh --scopes repo,workflow` |
| Custom domain serves the wrong content | DNS not pointed yet, or `origin` and `deploy.custom_domain` disagree — `pages:check` fails on the latter |
