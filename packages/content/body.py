"""The body grammar: one definition of what a `body:` may contain.

A `body:` is authored either as a plain string (one paragraph — the original
shape, still valid) or as a list whose entries are each a paragraph string or a
single-key block:

    body:
      - Opening paragraph, with {{work:slug|cross-links}} as before.
      - h2: A section heading
      - list:
          - first bullet
          - second bullet
      - quote: Someone else's sentence.
        cite: Who said it
      - code: |
          npm run build
        lang: bash
      - note: An aside the reader can skip.

Two functions matter to the rest of the build and they are the reason this
lives in its own module rather than inside emit_site:

  normalize()  the authored value -> a list of blocks, so every consumer sees
               one shape and no caller has to re-handle "string or list".

  body_text()  a body -> the flat prose the Fit corpus and the search index
               read. **Code blocks are excluded.** Fit cites by cutting a
               160-character window out of this text (snippetAround in
               src/fit/index.ts), so anything left in here can be shown to a
               recruiter as a quotation — and a half-line of shell is not a
               claim about someone's work. Everything else is prose the author
               wrote about their own work and is fair to quote.

src/content/bodyText.ts is the second implementation of exactly this, for the
browser. The two must agree: the browser builds its Fit pack from the generated
TS module while /api/fit reads dist/evidence.json emitted from here, so a
divergence makes the same JD answer differently depending on the path.
scripts/fit-smoke.ts asserts that parity.
"""

from __future__ import annotations

from typing import Any

# Block keys, and the extra keys each one allows. A block is a mapping with
# exactly one of these as its primary key; anything else is an authoring error
# rather than something to skip silently, because a body that quietly drops a
# section looks identical to one that never had it.
BLOCK_KEYS: dict[str, set[str]] = {
    "h2": set(),
    "h3": set(),
    "list": {"ordered"},
    "quote": {"cite"},
    "code": {"lang"},
    "note": set(),
}

# Blocks whose text is prose the author wrote, so it belongs in the Fit corpus
# and the search index. `code` is deliberately absent — see the module docstring.
PROSE_KEYS = ("h2", "h3", "quote", "note")


class BodyError(ValueError):
    """An authored body that cannot be rendered as written."""


def normalize(value: Any) -> list[Any]:
    """Authored `body:` -> a list of blocks. Raises BodyError on a bad block."""
    if value is None:
        return []
    if isinstance(value, str):
        text = value.strip()
        return [text] if text else []
    if not isinstance(value, list):
        raise BodyError(f"body must be a string or a list, got {type(value).__name__}")

    out: list[Any] = []
    for i, entry in enumerate(value):
        out.extend(_normalize_entry(entry, i))
    return out


def _normalize_entry(entry: Any, i: int) -> list[Any]:
    where = f"body[{i}]"
    if entry is None:
        return []
    if isinstance(entry, str):
        text = entry.strip()
        return [text] if text else []
    if not isinstance(entry, dict):
        raise BodyError(f"{where}: expected a paragraph string or a block, got {type(entry).__name__}")

    primary = [k for k in entry if k in BLOCK_KEYS]
    if len(primary) != 1:
        known = ", ".join(sorted(BLOCK_KEYS))
        raise BodyError(
            f"{where}: a block needs exactly one of [{known}], found "
            f"{sorted(entry) or 'nothing'}"
        )
    key = primary[0]
    allowed = BLOCK_KEYS[key] | {key}
    unknown = sorted(set(entry) - allowed)
    if unknown:
        extra = ", ".join(sorted(allowed - {key})) or "none"
        raise BodyError(f"{where}: {key} block does not take {unknown} (it takes: {extra})")

    if key == "list":
        raw_items = entry.get("list")
        # A bare string is iterable one character at a time, and `list: text` is
        # the same `key: text` shape that h2, h3 and note take — so the natural
        # mistake publishes a bullet per letter rather than failing.
        if raw_items is not None and not isinstance(raw_items, (list, tuple)):
            raise BodyError(
                f"{where}: list takes a sequence of bullets, got "
                f"{type(raw_items).__name__} — write each bullet as its own `- ` item"
            )
        items: list[str] = []
        for j, item in enumerate(raw_items or []):
            # `- Label: text` parses as a mapping, and str() on it would publish
            # a Python repr to the page.
            if isinstance(item, (dict, list, tuple)):
                raise BodyError(
                    f"{where}: list[{j}] must be text, got {type(item).__name__} — "
                    "a bullet is one line of text; quote it if it contains ': '"
                )
            text = " ".join(str(item or "").split())
            if text:
                items.append(text)
        if not items:
            return []
        block: dict[str, Any] = {"list": items}
        if entry.get("ordered"):
            block["ordered"] = True
        return [block]

    # `code` keeps its internal whitespace; everything else collapses like the
    # rest of the corpus so a YAML folded scalar does not carry line breaks.
    raw = entry.get(key)
    text = str(raw or "").rstrip() if key == "code" else " ".join(str(raw or "").split())
    if not text:
        return []
    block = {key: text}
    for extra_key in BLOCK_KEYS[key]:
        extra_val = entry.get(extra_key)
        if extra_key == "ordered":
            continue
        if str(extra_val or "").strip():
            block[extra_key] = " ".join(str(extra_val).split())
    return [block]


def body_text(value: Any) -> str:
    """Flat prose for the Fit corpus and search index. Excludes code blocks."""
    parts: list[str] = []
    for block in normalize(value):
        if isinstance(block, str):
            parts.append(block)
        elif "list" in block:
            parts.extend(block["list"])
        else:
            for key in PROSE_KEYS:
                if key in block:
                    parts.append(block[key])
                    if key == "quote" and block.get("cite"):
                        parts.append(block["cite"])
                    break
    return " ".join(" ".join(p.split()) for p in parts if p).strip()
