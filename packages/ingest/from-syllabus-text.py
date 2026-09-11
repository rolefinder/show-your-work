#!/usr/bin/env python3
"""Draft a content/courses/<slug>.yaml from a plain-text syllabus (stdout only).

The learning-outcomes section of a syllabus is the one place a course's skill
list is already written down, by the faculty who teach it, published before the
semester starts. This extracts it VERBATIM and hands it back for review. It
writes nothing.

Deliberately not a PDF parser. Syllabi have no common format, and a parser that
guesses at structure would violate the drafting contract ADR 018 sets: anything
the source does not state becomes a `TODO:` marker, never a guess. Save the
syllabus as text first (most viewers export it) and pass the file.

What it will NOT do, and this is the point: it does not name your skills for
you. Turning "design a normalized relational schema" into the label
`normalisation` is a paraphrase, and a paraphrase is a guess. `taught:` comes
back as TODO markers, one per outcome, for you to name or delete.

Nothing here publishes either. Every label under `taught:` is a CANDIDATE — the
build (packages/content/emit_site.py) publishes it only once one of the linked
projects already claims it. See ADR 032.

Usage:
  python packages/ingest/from-syllabus-text.py syllabus.txt
  python packages/ingest/from-syllabus-text.py syllabus.txt --slug mis-315
"""

from __future__ import annotations

import argparse
import re
from pathlib import Path

import yaml

# The lead-in a syllabus uses to introduce its outcomes. Several phrasings are
# in circulation and none is universal, so this matches the ones that actually
# recur rather than pretending there is a standard.
OUTCOME_HEADING = re.compile(
    r"^\s*(?:"
    r"(?:course\s+|student\s+)?learning\s+(?:outcomes|objectives|goals)"
    r"|(?:student\s+)?learning\s+outcomes"
    r"|course\s+objectives"
    r"|upon\s+successful\s+completion.*"
    r"|(?:by\s+the\s+end\s+of\s+this\s+course|after\s+completing\s+this\s+course).*"
    r")\s*:?\s*$",
    re.I,
)

# A new section starts at a heading-shaped line: short, no terminal period, and
# not itself a list item. Crude, and it has to be — the alternative is guessing.
BULLET = re.compile(r"^\s*(?:[-*•·]|\(?\d{1,2}[.)]|[a-z][.)])\s+(.*\S)\s*$", re.I)


def outcomes(text: str) -> list[str]:
    """Everything listed under the first outcomes heading, verbatim."""
    lines = text.splitlines()
    start = next((i for i, ln in enumerate(lines) if OUTCOME_HEADING.match(ln)), None)
    if start is None:
        return []

    found: list[str] = []
    for raw in lines[start + 1 :]:
        line = raw.rstrip()
        if not line.strip():
            if found:
                continue  # a blank line inside a list is not the end of it
            continue
        bullet = BULLET.match(line)
        if bullet:
            found.append(" ".join(bullet.group(1).split()))
            continue
        if found:
            # Prose after the list ends it. A wrapped continuation line is
            # indented further than the bullet, so it is appended instead.
            if line.startswith((" ", "\t")) and len(line) - len(line.lstrip()) >= 4:
                found[-1] += " " + " ".join(line.split())
                continue
            break
    return found


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("syllabus", type=Path, help="Path to a .txt syllabus")
    p.add_argument("--slug", default="", help="Filename stem; defaults to the input's")
    args = p.parse_args()

    text = args.syllabus.read_text(encoding="utf-8", errors="replace")
    found = outcomes(text)
    slug = args.slug or re.sub(r"[^a-z0-9-]+", "-", args.syllabus.stem.lower()).strip("-")

    print("# DRAFT — review before copying into content/courses/")
    if not found:
        print("#")
        print("# No learning-outcomes section found. This reads the list under a heading")
        print("# like 'Student Learning Outcomes' or 'Upon successful completion of this")
        print("# course, students will be able to:'. If your syllabus words it differently,")
        print("# copy the outcomes across by hand — they are the part worth having.")
    print("#")
    print("# `taught:` is candidate vocabulary and is NOT filled in for you: naming the")
    print("# skill behind an outcome is a paraphrase, and this never paraphrases a source.")
    print("# Whatever you write there publishes only if a linked project already claims it.")

    draft = {
        "slug": slug,
        "institution": "TODO: the institution that published this syllabus",
        "code": "TODO: catalogue code, e.g. MIS 315",
        "name": "TODO: course title as the institution publishes it",
        "completed": "TODO: when you finished it, e.g. 2022-05",
        "outcomes": found or ["TODO: quote each learning outcome from the syllabus"],
        "taught": [f"TODO: name the skill behind — {o}" for o in found]
        or ["TODO: name each skill the course taught"],
        "projects": ["TODO: slug of published work you produced in this course"],
        "visible": False,
    }
    # safe_dump, not f-strings: a syllabus is arbitrary text, and an outcome
    # containing ": " would otherwise inject a sibling key.
    print(yaml.safe_dump(draft, sort_keys=False, allow_unicode=True, width=88).rstrip())
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
