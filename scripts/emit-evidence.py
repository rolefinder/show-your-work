#!/usr/bin/env python3
"""Emit dist/evidence.json from content YAML (visible only)."""

from __future__ import annotations

import json
import sys
from pathlib import Path

try:
    import yaml
except ImportError:
    print("PyYAML required: pip install --user pyyaml", file=sys.stderr)
    sys.exit(1)

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "dist" / "evidence.json"


def main() -> int:
    profile = yaml.safe_load((ROOT / "content" / "about" / "profile.yaml").read_text(encoding="utf-8")) or {}
    docs = [
        {
            "id": "about",
            "kind": "about",
            "title": f"{profile.get('name', 'About')} — About",
            "url": "/about",
            "text": " ".join(
                [
                    str(profile.get("summary") or "").strip(),
                    str(profile.get("tagline") or "").strip(),
                    " ".join(profile.get("skills") or []),
                ]
            ),
            "skills": list(profile.get("skills") or []),
        }
    ]

    for path in sorted((ROOT / "content" / "work").glob("*.yaml")):
        w = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
        if w.get("visible") is False:
            continue
        docs.append(
            {
                "id": f"work:{w['slug']}",
                "kind": "work",
                "title": w["title"],
                "url": f"/work/{w['slug']}",
                "text": " ".join(
                    [
                        str(w.get("title") or ""),
                        str(w.get("summary") or "").strip(),
                        str(w.get("body") or "").strip(),
                        " ".join(w.get("skills") or []),
                    ]
                ),
                "skills": list(w.get("skills") or []),
            }
        )

    for path in sorted((ROOT / "content" / "blog").glob("*.yaml")):
        b = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
        if b.get("visible") is False:
            continue
        docs.append(
            {
                "id": f"blog:{b['slug']}",
                "kind": "blog",
                "title": b["title"],
                "url": f"/blog/{b['slug']}",
                "text": " ".join(
                    [
                        str(b.get("title") or ""),
                        str(b.get("summary") or "").strip(),
                        str(b.get("body") or "").strip(),
                        " ".join(b.get("skills") or []),
                    ]
                ),
                "skills": list(b.get("skills") or []),
            }
        )

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({"version": 1, "docs": docs}, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {OUT.relative_to(ROOT)} ({len(docs)} docs)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
