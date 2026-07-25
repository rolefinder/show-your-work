#!/usr/bin/env python3
"""Fail if content/ contains real-person / real-employer fingerprints.

Two directions, both only while site.yaml says demo: true.

NEGATIVE: no real identity may appear in the shipped demo corpus. Strategy
docs may mention harrison-site as the private dogfood — this gate only scans
content/.

POSITIVE: the demo persona must be self-evidently fake. Every route is now
prerendered with Person JSON-LD, so a demo deploy that was never customized
would publish structured data asserting a plausible-sounding human exists. A
name like "Fake Name" fails loudly; a name like "Avery Quill" fails plausibly.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CONTENT = ROOT / "content"

# Identity / employer fingerprints that must never appear in shipped corpus.
FORBIDDEN = [
    re.compile(r"\bharrison\b", re.I),
    re.compile(r"\bhalperin\b", re.I),
    re.compile(r"\bhhalperi", re.I),
    re.compile(r"harrisonhalperin", re.I),
    re.compile(r"quant-h2\.com", re.I),
    re.compile(r"\blpl\s+financial\b", re.I),
    re.compile(r"\bforgerock\b", re.I),
]

# Email domains allowed in demo content (everything else under content/ fails).
ALLOWED_EMAIL_DOMAINS = {"example.com", "example.org", "example.net"}


def is_demo() -> bool:
    """content/config/site.yaml demo flag. Absent or unreadable → assume demo."""
    cfg = ROOT / "content" / "config" / "site.yaml"
    if not cfg.is_file():
        return True
    for line in cfg.read_text(encoding="utf-8").splitlines():
        if line.strip().startswith("demo:"):
            return line.split(":", 1)[1].strip().lower() not in {"false", "no", "0"}
    return True


def check_obviously_fake() -> list[str]:
    """The demo persona and its work must announce themselves as placeholders."""
    problems: list[str] = []
    profile = ROOT / "content" / "about" / "profile.yaml"
    if profile.is_file():
        for line in profile.read_text(encoding="utf-8").splitlines():
            if line.startswith("name:") and "fake" not in line.lower():
                problems.append(
                    f"content/about/profile.yaml: demo persona name {line.split(':', 1)[1].strip()!r} "
                    "is not self-evidently fake - a stale demo deploy would publish "
                    "Person JSON-LD for a plausible-sounding human. Use e.g. 'Fake Name'."
                )
    for sub in ("work", "blog"):
        for path in sorted((ROOT / "content" / sub).glob("*.yaml")):
            if "fake" not in path.stem.lower():
                problems.append(
                    f"content/{sub}/{path.name}: demo slug is not self-evidently fake "
                    "- prefix it with 'fake-'."
                )
    return problems


def main() -> int:
    if not CONTENT.is_dir():
        print("content/ missing", file=sys.stderr)
        return 1

    # This gate protects the SHIPPED DEMO corpus from acquiring real-person
    # fingerprints. On an adopter's fork the corpus is supposed to be a real
    # person, so the gate would fail on correct content — and making them edit
    # this file's FORBIDDEN list would be exactly the kind of code change the
    # template promises they'll never need (ADR 016).
    if not is_demo():
        print("fictional-corpus skipped (site.yaml demo: false - corpus is the adopter's own)")
        return 0

    failures = check_obviously_fake()

    for path in sorted(CONTENT.rglob("*")):
        if not path.is_file():
            continue
        if path.suffix.lower() not in {".yaml", ".yml", ".md", ".txt", ".json"}:
            continue
        text = path.read_text(encoding="utf-8")
        rel = path.relative_to(ROOT).as_posix()
        for pat in FORBIDDEN:
            if pat.search(text):
                failures.append(f"{rel}: matched forbidden pattern {pat.pattern}")
        for m in re.finditer(r"[\w.+-]+@([\w.-]+\.[a-z]{2,})", text, re.I):
            domain = m.group(1).lower()
            if domain not in ALLOWED_EMAIL_DOMAINS:
                failures.append(f"{rel}: non-demo email domain @{domain}")

    if failures:
        print("fictional-corpus gate FAILED:", file=sys.stderr)
        for f in failures:
            print(f"  - {f}", file=sys.stderr)
        return 1

    print("fictional-corpus OK (content/ clean)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
