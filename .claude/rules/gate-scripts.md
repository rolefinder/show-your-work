---
paths:
  - "scripts/**"
---

# Writing a gate

Every script here is a gate, an emitter, or a preflight, and they share a shape
that is worth matching. The shape is not written down anywhere else — it only
exists in the files.

**Header docstring, naming the command it backs.** First line, always:

```js
/**
 * `bun run additive:check` — the template must stay add-only.
 *
 * <why this gate exists — ideally the bug that caused it>
 *
 * Exit 0 = add-only | 1 = a violation.
 */
```

The "why" matters more than the "what" here: every gate in this repo exists
because something already went wrong, and the next person needs to know what,
or they will delete it.

**Exit codes are the contract.**

| Code | Means |
|---|---|
| `0` | pass |
| `1` | a real failure — the thing this gate exists to catch |
| `2` | cannot run / needs a human (a missing dependency, an unauthenticated `gh`) |

`1` and `2` are genuinely different: an agent branches on them. Do not collapse
them, and do not use `1` for "no browser installed".

**`--help` prints the docstring.** The scripts that take flags do this with one
idiom, so a file documents itself and cannot drift from its own help:

```js
if (process.argv.includes("--help") || process.argv.includes("-h")) {
  console.log(readFileSync(fileURLToPath(import.meta.url), "utf8").split("*/")[0].replace(/^\/\*\*?/, ""));
  process.exit(0);
}
```

**`--json` when an agent will call it.** Structure, so the caller branches on
fields rather than parsing prose. The exit code stays the contract either way —
`--json` is a second view of the same answer, not a different answer.
`check-ready` and `pages:setup` both do this.

**Say what you found, not just that you failed.** `check-parity: ok (paths.py
and content-paths.mjs agree on 15 answers across 7 adopter states)` — the
counts are what make a passing gate believable and a failing one actionable.

**Wire it up.** A new gate needs a `package.json` script and a place in the
`test` chain, which CONTRIBUTING's "What CI runs" block mirrors. A gate nothing
runs is a comment.
