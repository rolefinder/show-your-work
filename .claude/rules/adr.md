---
paths:
  - "docs/architecture/adr/**"
---

# Writing an ADR

These are dated records. Everything below is about producing one that matches
the ones already here.

**Number.** The next free number on `main`, allocated at merge time — not
reserved when you start. Branches routinely collide on a number; whichever
lands first wins and the other renumbers. Check `ls docs/architecture/adr/`
rather than assuming.

**Filename.** `NNN-kebab-summary.md`, matching the `# ADR NNN:` heading.

**Status line**, third line of the file:

```
**Status:** Accepted · YYYY-MM-DD
```

Append ` · supersedes <what it replaces, with a link>` when it replaces an
earlier decision. The superseded document is **not** edited — that is what
makes it a record.

**Shape.** `## Context` (what was true, and what hurt) → `## Decision` →
`## Consequences`. Every ADR here has exactly those three; add others only
when they earn it. Rejected alternatives go in a blockquote inside Decision,
opening `> Rejected: **<the option>.**` — the reasoning for what you did *not*
do is the part a reader comes back for.

**Index it.** Add a row to the table in `docs/README.md`, or the ADR exists and
nothing links to it.

**Anchors are checked.** `bun run docs:links` resolves every relative link and
`#anchor` in the repo's markdown, including into other ADRs and the strategy
docs. An anchor you guessed at will fail there — write the link, then run it.
