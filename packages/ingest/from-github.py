#!/usr/bin/env python3
"""Draft work YAML stubs from the public GitHub API (stdout only)."""

from __future__ import annotations

import argparse
import json
import re
import sys
import urllib.parse
import urllib.request

import yaml

# GitHub's own rule: alphanumerics and single hyphens, 1-39 chars, no leading or
# trailing hyphen. Validated rather than escaped because anything outside this
# set is not a username, and interpolating one into the API path would let a
# value containing "/", "?" or "#" retarget the request.
USERNAME = re.compile(r"^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$")


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("username", help="Public GitHub username")
    p.add_argument("--limit", type=int, default=5)
    args = p.parse_args()

    if not USERNAME.match(args.username):
        print(f"not a GitHub username: {args.username!r}", file=sys.stderr)
        return 2
    limit = max(1, min(args.limit, 100))

    url = (
        "https://api.github.com/users/"
        f"{urllib.parse.quote(args.username, safe='')}"
        f"/repos?sort=updated&per_page={limit}"
    )
    req = urllib.request.Request(url, headers={"Accept": "application/vnd.github+json", "User-Agent": "show-your-work-ingest"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        repos = json.load(resp)

    print("# DRAFT — review before copying into content/work/")
    for repo in repos:
        if repo.get("fork"):
            continue
        slug = str(repo.get("name") or "repo").lower().replace("_", "-")
        # Every value here is third-party text from a repo this script did not
        # write. safe_dump quotes and escapes it; f-string interpolation let a
        # description containing ": " or a newline inject sibling keys.
        draft = {
            "slug": slug,
            "title": str(repo.get("name") or ""),
            "summary": str(repo.get("description") or "TODO"),
            "body": "TODO — expand from README; do not invent claims.",
            "skills": [],
            # Drafts never publish themselves. A human flips this after reading
            # the text, which is the contract in AGENTS.md — and the text came
            # from somebody else's repo, so nothing here has been reviewed yet.
            "visible": False,
        }
        print("---")
        print(yaml.safe_dump(draft, sort_keys=False, allow_unicode=True).rstrip())
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
