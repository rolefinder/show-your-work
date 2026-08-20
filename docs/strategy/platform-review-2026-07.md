# Platform review — standardization and adopter UX

**Date:** 2026-07-25 · against `main` @ `f1a7e8f`

Every finding below was reproduced against the real codebase, with the
measurement or repro recorded. Nothing here is inferred from reading alone.

---

## Part 1 — Platform decisions to standardize

### P1. Config key casing is inconsistent, and the reason leaks an internal detail

**Severity: high** (user-facing, silently wrong)

Three conventions live in one directory:

| File | Keys | Style |
|---|---|---|
| `content/config/site.yaml` | `title_suffix`, `short_name`, `theme_color`, `theme_color_dark` | snake_case |
| `content/work/*.yaml` | `skill_notes` | snake_case |
| `content/config/fit.yaml` | `extraStops`, `skillWeights`, `showGaps`, `extraCaveats` | **camelCase** |

The cause is not arbitrary: `emit-fit-config.py` does
`json.dumps(data)` — it passes the YAML **straight through** to
`dist/fit-config.json`, which is deserialized directly into the TypeScript
`FitMatchConfig`. So its keys must already be camelCase. Every other config
file passes through `emit_site.py`, which translates names.

An adopter has no way to know which file wants which style, and a
snake_case guess in `fit.yaml` fails *silently* — the key is simply ignored.

**Recommendation.** Author everything in snake_case and translate at the emit
boundary, the way every other config already does. `emit-fit-config.py` grows
a key-mapping step. Accept the old camelCase keys for one release with a
deprecation warning so existing forks don't break.

---

### P2. No validation layer — three classes of content error build green

**Severity: high** (one of them publishes a broken link)

The only content rule enforced anywhere is `slug == filename`
(`emit_site.py:182`). Three reproduced failures:

**(a) A dangling cross-link publishes a 404 into a live page.**

```
{{blog:this-post-does-not-exist|cite or missing}}
→ build exit 0 · corpus:check ok · seo-smoke ok
→ dist/work/…html contains href="/blog/this-post-does-not-exist"
→ that path is NOT in known-paths.json, so it serves a real 404
```

A recruiter clicking a link on your project page gets a 404. Nothing warns.

**(b) A one-character skill typo silently forks the taxonomy.**

Changing one `TypeScript` to `Typescript` produced *both* in the corpus. The
typo isn't in `skills.yaml`'s map, so it falls to "Other". It becomes a
separate skill-bank chip, a separate graph node, a separate search node, and
splits Fit's skill weighting — which is worth 14 points, the heaviest signal
in the matcher. No gate objected.

**(c) A missing required field throws a raw traceback.**

```
File "packages/content/emit_site.py", line 108, in emit_work_item
    f"    summary: {ts_string(str(w['summary']).strip())},\n"
KeyError: 'summary'
```

That's an internals stack trace for the single most common authoring mistake.

**Recommendation.** One `scripts/check-content.py` gate covering: required
fields (named file + field, not a traceback), cross-link targets resolve,
skills drawn from a known vocabulary (warn, don't block — new skills are
legitimate), and date format. This is the highest-value single addition on
this list.

---

### P3. Three runtimes in one build, with no stated rule

**Severity: medium** (cost and cognitive load)

| Runtime | Scripts | Notes |
|---|---|---|
| Python | 5 | content emit, evidence, fit-config, 2 gates |
| Node `.mjs` | 11 | bundling, gates, preview, prerender wrapper |
| `tsx` `.ts` | 4 | anything importing the generated module |

`tsx` costs **1.6s of startup per invocation**, ×4 in the build. The split is
principled — `.ts` is used exactly where a script must import
`src/generated/content.ts` — but that rule is nowhere written down, so the
next script is a coin flip.

**Recommendation.** Write the rule into `ARCHITECTURE.md`: *Python owns
YAML→artifact; `.ts` is only for importing the generated module; `.mjs` for
everything else.* Then reclaim the startup cost by merging the four `tsx`
steps into a single entry point (~5s off every build).

---

### P4. No CLI contract

**Severity: medium**

- **No script supports `--help`.** Not `init-site`, `check-ready`,
  `emit-html`, or `banner` — including the two an adopter is most likely to
  run directly.
- **Output prefixes are inconsistent.** Three scripts use
  `name: STATUS`; the Python gates use their own shapes.
- **Exit codes are inconsistent.** Only `check-ready` distinguishes 1
  (your config) from 2 (your toolchain). Every other gate exits 1 for
  everything, so a caller can't tell "fix your content" from "run npm ci".

**Recommendation.** A one-page CLI contract: `--help` on anything an adopter
runs, `name: ok|WARN|FAILED` prefixes, and the 0/1/2 exit convention applied
everywhere. Small, mechanical, and it makes `/build-show-your-work` more reliable
since the skill currently reads prose to decide what happened.

---

### P5. Two identifier namespaces for one corpus

**Severity: low** (internal, already recorded)

The knowledge graph uses `proj:` / `blog:` / `skill:`; Fit evidence uses
`work:` / `blog:`. Adapters translate at the boundary. Already flagged in
`ARCHITECTURE.md`; worth fixing next time either subsystem is opened rather
than as its own change.

---

### P6. Two evidence-pack implementations, held together by a test

**Severity: low** (mitigated, but structurally a liability)

`evidence.ts` and `emit-evidence.py` build the same pack for the browser and
the Worker. They *had* already diverged once. `fit-smoke` now compares them
field by field, which is a good mitigation — but the underlying duplication
remains, and every new field must be added twice.

**Recommendation.** Leave it. The test is cheap and the alternative (a build
step that emits both from one source) adds a moving part to save a rarely
touched file. Revisit only if a third consumer appears.

---

## Part 2 — Adopter UX

### U1. The authoring loop is 23 seconds with no watch mode

**Severity: high** — this is the single biggest friction.

Measured, step by step:

```
emit               0.6s
typecheck          2.0s
build:graph        0.9s
bundle             0.6s
emit:html          1.9s   ┐
emit:seo           1.8s   ├ 4 × tsx startup ≈ 6.4s
emit:evidence      0.5s   │
emit:fit-config    0.5s   │
build:fit-worker   0.5s   ┘
prerender         13.6s   ← 59% of the total
TOTAL             23.0s
```

There is **no `dev`, `watch`, or `start` script.** Fixing one sentence in a
project summary costs 23 seconds and a manual `npm run preview` restart.

**Recommendation — the top item on this list.** Add `npm run dev`:
watch `content/**` and `tokens/**`, re-run only `emit → bundle → emit:html`
(~3s), skip prerender entirely, and serve with the existing preview server.
Prerendering is a publish-time concern; nothing in the authoring loop needs
it. This turns 23s into ~3s and removes the manual restart.

### U2. Preview can silently serve a stale build

`npm run preview` serves `dist/` with no staleness check. Edit a YAML file,
forget to rebuild, and you are looking at old content with no indication.

**Recommendation.** Have `preview` compare the newest mtime under `content/`
against `dist/index.html` and print a loud warning. One-line fix, subsumed by
U1 if `dev` lands.

### U3. First-run reports six blockers at once

A fresh clone gives `check-ready` six blockers simultaneously. That is honest,
but it reads as a wall rather than a next step.

**Recommendation.** Order them by what to do first and lead with the single
next action — `npm run init` clears four of the six in one command, which the
output never says.

### U4. `init` doesn't finish the job it starts

`npm run init` writes identity and flips `demo: false`, but leaves the demo
corpus unless `--replace-content` is passed. So the default path produces a
site with your name over Fake Name's projects, and `check-ready` then blocks
on "still contains the demo corpus".

**Recommendation.** Prompt for it during `init` rather than requiring a flag
the adopter has to know exists.

### U5. Skills are free text with no discovery

There is no way to see the vocabulary in use while authoring. Combined with
P2(b), that's how typos happen.

**Recommendation.** `npm run skills` — print the current vocabulary with
counts and flag near-duplicates. Cheap, and it makes the taxonomy visible
where it's currently invisible.

---

## Recommended order

| # | Item | Why first |
|---|---|---|
| 1 | **U1 — `npm run dev`** | 23s → ~3s on the loop an author runs hundreds of times |
| 2 | **P2 — content validation gate** | Stops a broken link reaching a recruiter; kills a whole class of silent errors |
| 3 | **P1 — config casing** | User-facing inconsistency that fails silently |
| 4 | **P4 — CLI contract** | Mechanical; makes `/build-show-your-work` more reliable |
| 5 | **U3 / U4 — first-run polish** | Cheap once P4's conventions exist |
| 6 | **P3 — merge the tsx steps** | ~5s off every build; do alongside P4 |

P5 and P6 are deliberately **not** recommended for action now — one is
cosmetic, the other is already mitigated by a test that would have to be
written anyway.
