# ADR 024: The directory tree is machine-checked against the documented one

**Status:** Accepted · 2026-08-11

## Context

`ARCHITECTURE.md` carries an annotated tree of the repo, and it is the first
thing anyone — human or agent — reads to find out where work goes. Nothing
checked it. A prose map is exactly the kind of fact that rots: someone adds a
top-level directory, no gate fails, and later a second contributor cannot tell
whether a folder is intentional structure or something left behind.

This is not hypothetical. The first run of the gate found **two** directories
that had been committed for some time and appeared nowhere in the tree:
`assets/` — which holds the vendored React and the self-hosted graph engine,
i.e. the thing ADR 013 is about — and `.github/`, which holds CI. Both are
load-bearing. Neither was described.

The repo already has a rule for this class of problem: *one fact, one reader*.
A directory map that no reader consults is the first half of a drift bug.

## Decision

`scripts/check-layout.mjs`, wired in as `layout:check` and run **first** in
`npm test`, before every gate that assumes the layout.

It asserts three things:

1. Every committed top-level directory appears in `ARCHITECTURE.md`'s tree.
2. Every directory in that tree is either committed or explicitly generated
   (`dist/`, which the build writes and `.gitignore` hides).
3. No scratch output is committed — `_tmp_*`, `*.tmp`, `*.orig`, `*.rej`,
   `*.bak`, `.DS_Store`.

### The documented tree *is* the schema

The gate parses `ARCHITECTURE.md` rather than keeping a machine-readable list
of allowed directory names beside it.

> Rejected: **a separate `layout.yaml`**, which is how the sibling project this
> was ported from does it. Two files describing one contract is a second reader
> of the same fact, and it drifts exactly the way the prose drifted from the
> tree in the first place — with the added failure mode that the YAML passes
> while the prose lies, which is the worse of the two. Adding a top-level
> directory now means drawing it in the tree, which is where somebody would
> look for it anyway.

The parser is deliberately shallow: it reads only lines that start at column 0
with a branch glyph and name a directory. Nested entries are documentation, not
contract — asserting every file would make the tree a maintenance burden and
the gate a nuisance, and the failure it exists to catch is *"where did this
top-level folder come from"*, not *"is this file listed"*.

## Consequences

- A new top-level directory fails the build until it is documented. The failure
  names the directory and says what to do.
- `assets/` and `.github/` are now described in the tree, which they should
  have been already.
- The tree cannot describe a directory that no longer exists without failing.
- Deeper structure stays prose, and stays free to change without ceremony.
