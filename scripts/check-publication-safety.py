#!/usr/bin/env python3
"""Fail if YOUR content mentions something you said must never be published.

`corpus:check` protects the shipped DEMO corpus from acquiring real identity.
This is the other direction, and the one that matters once a site is yours: it
protects YOU from publishing an employer's internal detail — a project
codename, a client name, an internal hostname, a ticket prefix — in your own
writing.

Nothing else catches this. Your content is supposed to name a real person and
a real employer, so the fictional-corpus gate deliberately does not look at it.

Three sources for the terms, because they are not equally sensitive:

  content/config/corpus-guard.yaml   `never_publish:`   COMMITTED
      For terms that are not themselves secret — an employer's public name you
      simply do not want on a personal site. Safe to read; it ships.

  content/config/corpus-guard.local.yaml                GITIGNORED
      For terms you would not want in a published repository. Same shape.
      Never committed, so a public fork of your site does not hand a reader
      the list of things you were hiding.

  $RM_GUARD_TERMS  (comma-separated)                    CI
      The local file's equivalent for a build machine. Feed it from a
      repository secret so CI enforces the same rule without the list ever
      being in the tree.

Scans content/ (yours — content/demo/ belongs to the other gate) and dist/ when
it has been built, because dist/ is what actually ships.

Usage: python scripts/check-publication-safety.py [--help] [--list]
Exit 0 = clean | 1 = something would have been published | 2 = setup problem.
"""

from __future__ import annotations

import os
import re
import sys
from pathlib import Path

if "--help" in sys.argv or "-h" in sys.argv:
    print(__doc__)
    raise SystemExit(0)

try:
    import yaml
except ImportError:
    print("check-publication-safety: PyYAML required - run: pip install --user pyyaml", file=sys.stderr)
    raise SystemExit(2)

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))
from packages.content.paths import CONTENT, DEMO  # noqa: E402

# What you authored.
CONTENT_SUFFIXES = {".yaml", ".yml", ".md", ".txt", ".json"}

# What actually reaches a reader. Deliberately no .js/.css: app.js embeds the
# generated content module, so a real leak is already caught in the YAML it
# came from AND in the prerendered HTML — while React's own `data-*` handling
# matched a guarded ticket prefix in both the bundle and vendored react-dom.
# A gate that cries wolf on third-party code is a gate people stop reading.
DIST_SUFFIXES = {".html", ".htm", ".txt", ".json", ".xml"}


def load(path: Path) -> dict:
    if not path.is_file():
        return {}
    data = yaml.safe_load(path.read_text(encoding="utf-8"))
    return data if isinstance(data, dict) else {}


def terms() -> list[tuple[str, str]]:
    """(term, where it came from), so a failure says which list to edit."""
    out: list[tuple[str, str]] = []
    for rel, label in (
        ("corpus-guard.yaml", "content/config/corpus-guard.yaml"),
        ("corpus-guard.local.yaml", "content/config/corpus-guard.local.yaml"),
    ):
        for raw in load(CONTENT / "config" / rel).get("never_publish") or []:
            if str(raw).strip():
                out.append((str(raw).strip(), label))
    for raw in (os.environ.get("RM_GUARD_TERMS") or "").split(","):
        if raw.strip():
            out.append((raw.strip(), "$RM_GUARD_TERMS"))
    return out


def pattern(term: str) -> re.Pattern:
    """Case-insensitive, word-bounded only where the term's edges are words.

    Applied blindly, `\\bacme.io\\b` never matches, and `\\bDATA-\\b` never
    matches a ticket prefix like DATA-1234.
    """
    left = r"\b" if term[:1].isalnum() else ""
    right = r"\b" if term[-1:].isalnum() else ""
    return re.compile(left + re.escape(term) + right, re.I)


SCRIPT_OR_STYLE = re.compile(r"<(script|style)\b[^>]*>.*?</\1>", re.I | re.S)
TAG = re.compile(r"<[^>]*>", re.S)
ATTR_VALUE = re.compile(r"=\s*\"([^\"]*)\"|=\s*'([^']*)'")


def readable(text: str, suffix: str) -> str:
    """For HTML, what a person could actually read — not the markup.

    A guarded ticket prefix like `DATA-` matched every `data-*` attribute in
    the prerendered documents, which is noise that would train someone to
    ignore this gate. Attribute VALUES are kept, because that is where
    <meta name="description" content="..."> puts authored prose; attribute
    names and tag names are dropped.
    """
    if suffix not in {".html", ".htm"}:
        return text
    body = SCRIPT_OR_STYLE.sub(" ", text)
    # Replace each tag with just its quoted attribute values.
    return TAG.sub(
        lambda m: " " + " ".join(v or w for v, w in ATTR_VALUE.findall(m.group(0))) + " ",
        body,
    )


def scan_targets() -> list[Path]:
    files: list[Path] = []
    if CONTENT.is_dir():
        for p in CONTENT.rglob("*"):
            # content/demo/ is the other gate's business, and the guard files
            # necessarily contain the very strings they forbid.
            if DEMO in p.parents or p.name.startswith("corpus-guard"):
                continue
            if p.is_file() and p.suffix.lower() in CONTENT_SUFFIXES:
                files.append(p)
    dist = ROOT / "dist"
    if dist.is_dir():
        for p in dist.rglob("*"):
            if "vendor" in p.parts:
                continue  # third-party code, not anything you wrote
            if p.is_file() and p.suffix.lower() in DIST_SUFFIXES:
                files.append(p)
    return files


def main() -> int:
    guarded = terms()
    if not guarded:
        print(
            "check-publication-safety: no terms declared - nothing to enforce.\n"
            "  Run /sanitize to work out what belongs on the list, or add\n"
            "  `never_publish:` to content/config/corpus-guard.yaml."
        )
        return 0

    compiled = [(pattern(t), t, src) for t, src in guarded]
    files = scan_targets()
    failures: list[str] = []

    # Say so rather than quietly checking half of what the name implies. This
    # gate was briefly ordered BEFORE `build` in bun run test, so on a clean CI
    # checkout dist/ did not exist and only the YAML was scanned - and a term
    # that reaches the artifact through a Fit quote, without appearing
    # literally in any content file, would have passed unseen.
    if not (ROOT / "dist").is_dir():
        print(
            "check-publication-safety: WARNING - dist/ not built, so only your source\n"
            "  content was scanned. A term can reach the published artifact through a Fit\n"
            "  quote or a JSON-LD field without appearing literally in any YAML.\n"
            "  Run `bun run build` first.",
            file=sys.stderr,
        )

    for path in sorted(files):
        try:
            text = path.read_text(encoding="utf-8")
        except (UnicodeDecodeError, OSError):
            continue
        rel = path.relative_to(ROOT).as_posix()
        text = readable(text, path.suffix.lower())
        for pat, term, src in compiled:
            m = pat.search(text)
            if not m:
                continue
            # Stripping markup collapses newlines, so a line number would be a
            # lie for HTML. Name the file and let them search it.
            if path.suffix.lower() in {".html", ".htm"}:
                where = rel
            else:
                where = f"{rel}:{text[: m.start()].count(chr(10)) + 1}"
            failures.append(f"{where}: publishes {m.group(0)!r} (declared in {src})")

    if failures:
        print("check-publication-safety: FAILED", file=sys.stderr)
        # Deduplicate: dist/ mirrors content/, so one slip reports many times.
        for f in sorted(set(failures)):
            print(f"  - {f}", file=sys.stderr)
        print(
            "\n  These would ship. Rewrite the sentence - do not remove the term from\n"
            "  the guard list to make this pass.",
            file=sys.stderr,
        )
        return 1

    print(
        f"check-publication-safety: ok ({len(guarded)} guarded term(s), "
        f"{len(files)} file(s) scanned)"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
