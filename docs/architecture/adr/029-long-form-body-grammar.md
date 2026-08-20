# ADR 029: Long-form body grammar

**Status:** Accepted
**Date:** 2026-08-15

## Context

A `body` was one string, rendered as one `<p>`:

```
src/types.ts             body: string
emit_site.py             body: <one squashed string>
src/app.tsx              React.createElement("p", {className:"prose"}, richText(body, …))
```

`richText` converts `{{work:slug|Label}}` cross-links and nothing else. So no
project page and no blog post could contain a heading, a list, a quote, a code
block, a callout, an image or a diagram. The template's target user is someone
publishing engineering work, and the artifact they most want to publish — a
long-form write-up with sections and a code sample — was the one thing the
template could not express. `docs/strategy/design-review-2026-08.md` records
this as D4, the largest single ceiling on the product.

The sibling project (harrison-site) hit the same wall and solved it in its
ADR 008: a `body[]` whose entries are a plain string, `{h2}` or `{figure}`.
This adapts that decision, widened, for this repo's content pipeline and its
Fit contract — which is where the interesting constraint lives.

## Decision

1. **`body` is a list of blocks; a string still means one paragraph.** An entry
   is either a paragraph string or a single-key mapping: `h2`, `h3`, `list`
   (with optional `ordered`), `quote` (with optional `cite`), `code` (with
   optional `lang`), or `note`. The authored form is documented in
   `docs/guide/authoring.md`; the grammar itself lives in
   `packages/content/body.py`.

2. **Normalization happens at the emit boundary.** `ts_body()` turns the
   authored value into a `BodyBlock[]` literal, so no runtime code re-handles
   "string or list" and existing adopter content keeps working unchanged. This
   follows the same principle as ADR 016: author in the shape that is pleasant
   to write, translate once, and let everything downstream see one shape.

3. **Code blocks are excluded from the Fit corpus.** This is the load-bearing
   decision. Fit builds a citation by cutting a 160-character window out of
   `doc.text` (`snippetAround`, `src/fit/index.ts`), so anything left in that
   text can be shown to a recruiter *as a quotation of the candidate's work*.
   Half a line of shell is not a claim about anyone's work. `body_text()`
   therefore skips `code` and keeps every other block, all of which are prose
   the author wrote. Code is rendered on the page and indexed by nothing.

4. **The grammar has two implementations, and they must agree.**
   `packages/content/body.py` serves the emitted module and
   `dist/evidence.json`; `src/content/bodyText.ts` serves the browser. The two
   Fit paths would otherwise answer the same JD differently — `fit:smoke`
   already asserts that parity, and now covers this too.

5. **A malformed block fails the build, naming the file and the block index.**
   Not a warning, and not a skip: a section that silently disappears is
   indistinguishable from one that was never written. Both `check-content.py`
   and the emitter report it; neither raises a traceback
   (platform-review-2026-07 P2(c)).

   This includes the *shape* of a `list`, not only the block key. A bare string
   is iterable one character at a time, and `list: A bullet` is the same
   `key: text` shape `h2`, `h3` and `note` take — so the natural mistake would
   otherwise publish one bullet per letter. A mapping item (`- Label: text`,
   which is how an unquoted bullet containing `": "` parses) would publish a
   Python repr to the page. Both are rejected. This is worse than the silent
   disappearance the rule above is about: it silently publishes garbage.

6. **`image` and `figure` are designed for and deliberately absent.** Each needs
   a subsystem that does not exist yet — an asset pipeline (design review D6)
   and a diagram kit (D5). Adding a variant to the union is additive, so they
   arrive with the subsystems that render them rather than as placeholders.

7. **Vertical rhythm belongs to the flow, not to the blocks.** `.prose > *`
   clears child margins and `.prose > * + *` sets the gap, so a block type added
   later inherits the rhythm. The corollary is a rule for future edits: a block
   rule must not set `margin` — `margin: 0` is more specific than the flow rule
   and silently closes the gap above it, which is what the first draft of this
   change did to `ul`, `blockquote` and `pre`.

## Consequences

- Existing content is unaffected: a `body: >` string emits a single-element
  array and renders exactly as before.
- Prose entries must be `>` block scalars when they contain `": "`, because a
  plain YAML scalar ends there. This bites cross-link labels with colons
  (`{{work:slug|Fake Project: Merge Gate}}`) and is called out in the guide.
- Search and the knowledge graph read the same flattened text, so a cross-link
  authored inside a heading or a bullet still produces a graph edge.
- `check-content.py` validates cross-links against `body_text()` — the same text
  the renderer turns into links — so link validation and link rendering cannot
  drift apart.
- The Fit corpus shrinks slightly for any page that adds code, which is the
  intent. It does not shrink for existing pages.
- `src/content/bodyText.ts` is named that rather than `body.ts` because
  `Body.tsx` sits beside it, and on a case-insensitive filesystem — macOS, and
  the Windows the README's quick start assumes — `../content/body` resolves to
  the renderer and the bundle fails to build.
