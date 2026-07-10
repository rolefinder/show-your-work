#!/usr/bin/env python3
"""Lightweight secret / credential pattern scan for tracked source.

Not a replacement for GitHub secret scanning or gitleaks — a practical
baseline that fails CI on obvious leaks before a public flip.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

SKIP_DIR_NAMES = {
    ".git",
    "node_modules",
    "dist",
    ".venv",
    "venv",
    "__pycache__",
    ".pytest_cache",
    ".ruff_cache",
    "assets",  # vendored minified JS
}

SKIP_SUFFIXES = {
    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".webp",
    ".ico",
    ".woff",
    ".woff2",
    ".ttf",
    ".map",
    ".lock",
}

# High-signal patterns only (avoid noisy false positives on demo copy).
PATTERNS: list[tuple[str, re.Pattern[str]]] = [
    (
        "AWS access key id",
        re.compile(r"AKIA[0-9A-Z]{16}"),
    ),
    (
        "GitHub PAT (classic)",
        re.compile(r"ghp_[A-Za-z0-9]{36}"),
    ),
    (
        "GitHub fine-grained / OAuth / App token",
        re.compile(r"gh[ours]_[A-Za-z0-9_]{36,}"),
    ),
    (
        "Slack token",
        re.compile(r"xox[baprs]-[A-Za-z0-9-]{10,}"),
    ),
    (
        "OpenAI-style sk- key",
        re.compile(r"sk-[A-Za-z0-9]{20,}"),
    ),
    (
        "Private key block",
        re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----"),
    ),
    (
        "Cloudflare API token assignment",
        re.compile(
            r"(?i)(?:cloudflare|cf)[_-]?(?:api)?[_-]?token\s*[=:]\s*['\"]?[A-Za-z0-9_-]{30,}"
        ),
    ),
    (
        "Generic high-entropy secret assignment",
        re.compile(
            r"(?i)(?:api[_-]?key|secret[_-]?key|access[_-]?token|auth[_-]?token)"
            r"\s*[=:]\s*['\"][A-Za-z0-9/+=_-]{24,}['\"]"
        ),
    ),
]

ALLOW_PATH_SNIPPETS = (
    # Example / docs placeholders are fine
    "wrangler.example.toml",
    "docs/strategy/recruit-me-security.md",
    "scripts/check-secrets.py",  # this file contains pattern strings
)


def should_skip(path: Path) -> bool:
    rel = path.relative_to(ROOT).as_posix()
    for part in path.parts:
        if part in SKIP_DIR_NAMES:
            return True
    if path.suffix.lower() in SKIP_SUFFIXES:
        return True
    if any(s in rel for s in ALLOW_PATH_SNIPPETS):
        return True
    return False


def main() -> int:
    hits: list[str] = []
    for path in ROOT.rglob("*"):
        if not path.is_file() or should_skip(path):
            continue
        try:
            text = path.read_text(encoding="utf-8")
        except (UnicodeDecodeError, OSError):
            continue
        rel = path.relative_to(ROOT).as_posix()
        for name, pat in PATTERNS:
            for m in pat.finditer(text):
                line = text.count("\n", 0, m.start()) + 1
                hits.append(f"{rel}:{line}: {name}")

    if hits:
        print("Secret scan FAILED — possible credentials in tree:", file=sys.stderr)
        for h in hits[:50]:
            print(f"  {h}", file=sys.stderr)
        if len(hits) > 50:
            print(f"  … and {len(hits) - 50} more", file=sys.stderr)
        return 1

    print("secret-scan ok (no high-signal credential patterns)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
