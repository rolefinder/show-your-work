# ADR 023: bun installs and runs TypeScript; Node still runs the gates

**Status:** Accepted · 2026-08-20

## Context

The build had two package-manager-shaped jobs, and npm was doing both badly.

**Installing.** `npm ci` against a 36k-line `package-lock.json`, for eighteen
packages.

**Running TypeScript.** Four build steps are `.ts` — `emit-html`,
`emit-seo-artifacts`, `prerender-routes` and `fit-smoke` — and Node cannot
execute them. Each was spawned as `npx --yes tsx <script>`, which put a transpiler in
`devDependencies`, a `--yes` network-capable resolution step in the build path,
and ~1.6s of startup per invocation. That cost is on the record: the
[platform review](../../strategy/platform-review-2026-07.md#p3-three-runtimes-in-one-build-with-no-stated-rule)
measured 1.6s × 4 invocations against a ~23s build, and the fix it proposed —
merge the four steps into fewer processes — was a workaround for that startup
cost, not a removal of it.

bun does both jobs, and executes TypeScript as a first-class input.

## Decision

**bun is the package manager.** `bun install` / `bun install --frozen-lockfile`,
`bunx` in place of `npx`, `bun run <script>` in place of `npm run <script>`.
`bun.lock` — the text lockfile, not the legacy binary `bun.lockb` — is
committed and marked `linguist-generated`. `package-lock.json` is deleted.

**bun is the TypeScript runner.** The four `.ts` entry points are invoked as
`bun scripts/<name>.ts` and their shebangs are `#!/usr/bin/env bun`. **`tsx` is
removed from `devDependencies`** — nothing else used it. TypeScript itself
stays: `typecheck` is still `tsc --noEmit`, because bun *executes* types, it
does not *check* them.

**Node still runs everything else.** Every gate under `scripts/*.mjs` is a Node
program, and the lint job's `node --check` has no bun equivalent. So CI sets up
both runtimes deliberately — `oven-sh/setup-bun` reading `.bun-version`,
`actions/setup-node` reading `.nvmrc` — rather than inheriting whatever the
runner happens to ship. Two files pin two runtimes, in the same style.

> Rejected: **making bun the only JavaScript runtime.** It would mean rewriting
> fourteen working `.mjs` gates against a second runtime's edges to save one
> `setup-node` step, and giving up `node --check` — the cheapest gate in the
> repo — for nothing.

**Dependabot moves to `package-ecosystem: bun`**, which is what reads
`bun.lock`.

## Consequences

- **Installs stop being a step you notice.** On this tree, with warm caches and
  no `node_modules`: `npm ci` 1.95s, `bun install --frozen-lockfile` 0.017s.
  The build's four tsx startups — ~6.4s by the platform review's measurement —
  are gone outright rather than batched.
- **`emit-artifacts.ts` outlives its own rationale.** It existed to pay tsx's
  startup once instead of twice; under bun that saving is ~36ms. It stays
  because emit-html must write `dist/index.html` before emit-seo reads the same
  route table — ordering, which was always the other half of the reason.
- **Adopters install one more thing.** bun, Node, Python and PyYAML, where it
  used to be Node, Python and PyYAML. `check-ready` probes for bun by running
  it — the same way it probes for a Python interpreter, and for the same
  reason: a name on `PATH` is not proof of a working program.
- **`bun test` is a trap, and a quiet one.** It invokes bun's own test runner,
  which matches no files in this repo, prints `0 test files matching`, and
  **exits 0**. Every gate here is a `package.json` script, so the runner never
  sees one. `AGENTS.md` lists it alongside the other two silent failure modes,
  because an agent that reports green off `bun test` has run nothing at all.
- **Cloudflare Pages does not read `.bun-version`.** Its build image ships its
  own bun (1.2.15 at the time of writing, above this repo's floor), overridable
  with a `BUN_VERSION` build variable. [The deploy
  guide](../../guide/deploy.md#cloudflare-pages) says so; nothing enforces it,
  because nothing in this repo can see that dashboard.
- **The `--` in `npm run x -- --flag` is gone.** bun forwards script arguments
  without it. Both forms work; the docs use the shorter one.
