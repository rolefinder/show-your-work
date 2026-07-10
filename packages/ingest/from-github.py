#!/usr/bin/env python3
"""Draft work YAML stubs from the public GitHub API (stdout only)."""

from __future__ import annotations

import argparse
import json
import sys
import urllib.request


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("username", help="Public GitHub username")
    p.add_argument("--limit", type=int, default=5)
    args = p.parse_args()

    url = f"https://api.github.com/users/{args.username}/repos?sort=updated&per_page={args.limit}"
    req = urllib.request.Request(url, headers={"Accept": "application/vnd.github+json", "User-Agent": "recruit-me-ingest"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        repos = json.load(resp)

    print("# DRAFT — review before copying into content/work/")
    for repo in repos:
        if repo.get("fork"):
            continue
        slug = str(repo.get("name") or "repo").lower().replace("_", "-")
        print("---")
        print(f"slug: {slug}")
        print(f"title: {repo.get('name')}")
        print(f"summary: {repo.get('description') or 'TODO'}")
        print("body: TODO — expand from README; do not invent claims.")
        print("skills: []")
        print("visible: true")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
