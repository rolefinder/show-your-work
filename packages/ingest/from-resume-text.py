#!/usr/bin/env python3
"""Draft about/work YAML snippets from a plain-text resume (stdout only)."""

from __future__ import annotations

import argparse
import re
from pathlib import Path

import yaml


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("resume", type=Path, help="Path to .txt resume")
    args = p.parse_args()
    text = args.resume.read_text(encoding="utf-8", errors="replace")
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    name = lines[0] if lines else "Your Name"
    skills = sorted(
        {
            m.group(0)
            for m in re.finditer(
                r"\b(Python|TypeScript|JavaScript|AWS|Terraform|CI/CD|React|Go)\b",
                text,
                re.I,
            )
        }
    )
    print("# DRAFT — review before copying into content/")
    # safe_dump, not f-strings: the first line of a resume is arbitrary text,
    # and one containing ": " would otherwise inject a sibling key.
    draft = {
        "name": name,
        "summary": "TODO: write a short published summary from the resume.",
        "skills": skills or ["TODO"],
    }
    print(yaml.safe_dump(draft, sort_keys=False, allow_unicode=True).rstrip())
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
