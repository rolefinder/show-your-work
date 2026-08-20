# Agent guide

For any coding agent working in this repository or in a fork of it. Humans
want [CONTRIBUTING.md](./CONTRIBUTING.md) or
[docs/guide](./docs/guide/README.md).

## Which job are you doing?

**Building someone's site from this template.** Then you should not be editing
anything at all — only adding. `content/demo/` holds everything the template
ships; you write files at the matching paths outside it and they take over
(ADR 021). If a task seems to need you to edit or delete a shipped file, that
is a bug worth reporting, not a step. `init` refuses to overwrite for the same
reason.

You should not be editing code either. Everything that identifies a deployment lives in `content/`, and
`bun run config:check` fails the build if a name, email or title suffix appears
under `src/`, `functions/`, `graph/` or `public/`. If a task seems to require a
code edit to stand up a site, that is a bug in the template — report it rather
than working around it. Use **`/launch`** for the whole path, fork to live URL.

**Changing the template itself.** Read [CONTRIBUTING.md](./CONTRIBUTING.md).

## Skills in this repo

Available in any fork with no install step, because they live in
`.claude/skills/`:

| Command | Does |
|---|---|
| `/launch` | **The whole path** — identity, build, one authorization, live on GitHub Pages |
| `/build-recruit-me` | Preflight config, optionally draft content from named sources, build with prerendering, verify |
| `/deploy-pages` | Cloudflare Pages, for real response headers and `/api/fit` |
| `/ui-review` | The design judgement `ux:check` cannot make |
| `/sanitize` | Find employer-internal detail before it publishes, and guard against its return. Employers are discovered from the adopter's own resume and GitHub, never hardcoded |

## Working on the human's behalf

The design goal is that a person answers questions once and then leaves. Two
rules make that safe rather than reckless.

**Ask everything up front, in one batch.** Use AskUserQuestion, not a trickle of
prompts. Then take a single explicit authorization before anything leaves the
machine — naming the repository, its visibility, and each action — and do not
interrupt again until you have a URL or a real blocker.

**Never handle a credential.** Not a password, not a token, not a 2FA code; not
into a browser, a prompt, or a file. Authentication is the human's, in their own
terminal. `pages:setup` has no prompt path at all: it asks `gh` whether they
already authenticated and exits `2` with the exact command if not.

Scripts meant for you separate the two failure kinds by exit code — **`1` failed,
`2` needs a human** — and take `--json` so you branch on structure instead of
parsing prose. `check-ready --json` and `pages:setup --json` both do this. Use
`--dry-run` first where it exists.

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
- `bun run ready` blocks on a published file that still contains `TODO`.

## Verify by running, not by reading

`bun run test` runs fourteen gates around one full build, and each one names
what it found. Do not report work as done on the strength of having read the
diff.

```bash
bun run dev     # authoring loop, ~2s rebuilds — use this while iterating
bun run test    # before you push
```

Three failure modes worth knowing about, because all three are quiet:

- **`bun test` is not `bun run test`.** Bare `bun test` invokes bun's own test
  runner, which finds no `*.test.ts` in this repo, prints `0 test files
  matching` — and **exits 0**. Every gate is a `package.json` script, so the
  runner never sees them. Always `bun run test`.
- **Prerendering is optional.** Without Chromium the build still succeeds and
  produces an SPA-only `dist/` — you get a warning, not an error, and every
  route ships the home page's metadata. Set `PRERENDER_REQUIRED=1` when the
  output matters.
- **`python3` on Windows is the Microsoft Store stub.** It exists, satisfies
  `command -v`, and exits non-zero. Probe by running an interpreter, not by
  looking it up on `PATH`.

## One fact, one reader

Before adding a regex, a `grep`, or a second parser for something the codebase
already knows: **it already knows it, so ask it.** Four bugs in this repo came
from one fact acquiring two readers that then drifted — the full table is in
[CONTRIBUTING.md](./CONTRIBUTING.md#one-fact-one-reader).

- Node-side YAML scalars: `scripts/lib/yaml-lite.mjs`. Do not write another.
- A workflow needing a decision the code makes: call the code
  (`check-pages-target.mjs --deploy-guard`), do not re-derive it in bash.
- A second implementation that is genuinely unavoidable: add it to
  `scripts/check-parity.mjs`, which asserts the pair agree.

## Do not

- Hand-edit anything in the generated table in
  [CONTRIBUTING.md](./CONTRIBUTING.md#things-that-are-generated).
- Put a raw color in `styles.css`. Add a token in `tokens/`.
- Widen the CSP, or load React, the graph engine, or a model host from a CDN.
- Vendor or bundle third-party code without adding it to
  [THIRD-PARTY-NOTICES.md](./THIRD-PARTY-NOTICES.md). Self-hosting is how this
  repo satisfies the CSP, and self-hosting is redistribution. Build tooling is
  exempt — it never reaches `dist/`.
- Rewrite an ADR to match a later decision. Add a new one.
- Adjust `parity:check` to make it pass. Fix the divergence it found.
- Update `docs/history/`. It is a dated record; that is the point.
- Change a token to make `ux:check` pass. The check composites alpha against
  the real background — if it fails, it is right. State the proposed value and
  why.
