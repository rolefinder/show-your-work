# Agent guide

For any coding agent working in this repository or in a fork of it. Humans
want [CONTRIBUTING.md](./CONTRIBUTING.md) or
[docs/guide](./docs/guide/README.md).

## Which job are you doing?

**Building someone's site from this template.** Then you should not be editing
code at all. Everything that identifies a deployment lives in `content/`, and
`npm run config:check` fails the build if a name, email or title suffix appears
under `src/`, `functions/`, `graph/` or `public/`. If a task seems to require a
code edit to stand up a site, that is a bug in the template — report it rather
than working around it. Use `/build-recruit-me`, then `/deploy-pages`.

**Changing the template itself.** Read [CONTRIBUTING.md](./CONTRIBUTING.md).

## Skills in this repo

Available in any fork with no install step, because they live in
`.claude/skills/`:

| Command | Does |
|---|---|
| `/build-recruit-me` | Preflight config, optionally draft content from named sources, build with prerendering, verify |
| `/deploy-pages` | Fork to a live site on Cloudflare Pages |
| `/ui-review` | The design judgement `ux:check` cannot make |

> Note for anyone porting this layout: plugin repos put `skills/` at the root
> with a `.claude-plugin/` manifest, because they are *installed* into another
> project. recruit-me is *forked*, so its skills must be live in the fork
> itself — which is what `.claude/skills/` gives.

## Never invent content

This is the one rule the whole project rests on. Fit's answer to a recruiter is
trustworthy only because the matcher can quote nothing that is not already
published in `content/` — it cannot fabricate an employer, a date, or a metric.

So when drafting content from a source:

- Write drafts as `visible: false`. Nothing publishes until a human flips it.
- Anything the source does not state becomes a `TODO:` marker. Never a guess.
- `npm run ready` blocks on a published file that still contains `TODO`.

## Verify by running, not by reading

`npm test` runs ten gates and each one names what it found. Do not report work
as done on the strength of having read the diff.

```bash
npm run dev     # authoring loop, ~2s rebuilds — use this while iterating
npm test        # before you push
```

Two failure modes worth knowing about, because both are quiet:

- **Prerendering is optional.** Without Chromium the build still succeeds and
  produces an SPA-only `dist/` — you get a warning, not an error, and every
  route ships the home page's metadata. Set `PRERENDER_REQUIRED=1` when the
  output matters.
- **`python3` on Windows is the Microsoft Store stub.** It exists, satisfies
  `command -v`, and exits non-zero. Probe by running an interpreter, not by
  looking it up on `PATH`.

## Do not

- Hand-edit anything in the generated table in
  [CONTRIBUTING.md](./CONTRIBUTING.md#things-that-are-generated).
- Put a raw color in `styles.css`. Add a token in `tokens/`.
- Widen the CSP, or load React, the graph engine, or a model host from a CDN.
- Rewrite an ADR to match a later decision. Add a new one.
- Update `docs/history/`. It is a dated record; that is the point.
- Change a token to make `ux:check` pass. The check composites alpha against
  the real background — if it fails, it is right. State the proposed value and
  why.
