#!/usr/bin/env python3
"""Draft about/work YAML snippets from a plain-text resume (stdout only)."""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path


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
    print("name:", name)
    print("summary: |")
    print("  TODO: write a short published summary from the resume.")
    print("skills:")
    for s in skills or ["TODO"]:
        print(f"  - {s}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
