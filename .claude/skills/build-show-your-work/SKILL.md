---
name: build-show-your-work
description: Take a filled-in show-your-work config and produce the deployable site — preflight the config, optionally draft content from the adopter's own sources via a workflow, build with prerendering, and verify. Use when the user runs /build-show-your-work, or asks to "build my site", "generate my portfolio", or "turn my config into a site".
---

# /build-show-your-work

Turn `content/` into `dist/`. The adopter's job is to fill in config and write
(or approve) their content; this command does everything after that.

## The contract this command must not break

This project's product is a Fit brief where every aligned claim cites a
published page. That only works if the published pages are true. So:

- **Never invent content.** Not an employer, a date, a metric, a team size, or
  an outcome. If a source doesn't say it, it becomes `TODO:` for the human.
- **Never publish unreviewed drafts.** Drafting writes `visible: false`. Only
  the human flips that.
- **Never edit `src/`** to make a build work. Identity and content belong in
  `content/`; `bun run config:check` fails the build if identity leaks into
  code. If something can only be fixed in `src/`, that is a template bug worth
  reporting, not a setup step.

## Steps

### 1. Preflight

```bash
node scripts/check-ready.mjs
```

Exit 0 = ready. Exit 1 = placeholders remain; it lists each one. Report the
list verbatim and stop — do not guess the user's name, domain, or skills to
get past it. If they haven't set up at all, point them at `bun run init`.

Warnings (missing Playwright, missing `outcome`/`evidence`, drafts awaiting
review) do not block. Surface them; they change the quality of the result.

### 2. Draft from sources — only if asked

Read `content/config/sources.yaml`. If it names a `github.user` or a `resume`
**and** the user asked for drafting (or has no content yet), offer it. This
step spawns subagents and writes files, so it is opt-in, not automatic.

On approval, run the `draft-content` workflow with the parsed sources:

- `sources` — the parsed `sources.yaml`
- `maxCandidates` — default 8

It discovers candidates per source in parallel, drafts one YAML per candidate,
and adversarially re-checks each draft against only its own source facts.

When it returns, report per draft: path, TODO count, and any **ungrounded
claims**. Ungrounded claims are the important output — they are the workflow
catching itself inventing. Tell the user to fix or delete those lines, then
flip `visible: true` on the drafts they accept.

Then re-run step 1.

### 3. Build

```bash
bun run test
```

This runs every gate plus the full build: content emit → typecheck → bundle →
identity injection → SEO artifacts → evidence pack → Fit worker → prerender.
Prefer it over `bun run build` — the gates are the point.

If Playwright is missing, the build warns and produces an SPA-only `dist`.
That is a legitimate state, but say so plainly: per-route metadata will be
invisible to crawlers that don't run JS. `bunx playwright install chromium`
fixes it.

### 4. Verify what actually shipped

Don't infer success from a green exit code. Check the artifact:

```bash
node scripts/preview.mjs
```

Then confirm, and report concretely:

- `dist/index.html` `<title>` is the user's name, not a placeholder
- a project route (`dist/work/<slug>.html`) has **its own** title and
  `<link rel="canonical">`, which is prerendering having worked
- `dist/llms.txt` lists their real work
- the JSON-LD `Person` carries their identity and profile links
- a Fit brief's caveats contain no demo disclaimer

Stop the preview server when done.

### 5. Report

Give them: what was built (route count, prerendered or not), what needs their
attention (TODOs, ungrounded claims, drafts still `visible: false`), and the
deploy step — Pages project pointing at `dist/`, with `PRERENDER_REQUIRED=1`
in the build environment so a deploy can't silently ship without prerendering.

## Notes

- `content/config/sources.yaml` is optional. No sources means step 2 is skipped
  entirely and hand-written content is used as-is.
- YouTube is a link today (`profile.yaml` → `links.youtube`), not a source.
  Making a channel a *source* needs a transcript provider (captions or STT)
  before there is anything grounded to draft from — see ADR 018.
- Adding a platform to `links` never requires code: the label is derived from
  the key.
