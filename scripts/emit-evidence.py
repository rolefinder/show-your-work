#!/usr/bin/env python3
"""Emit dist/evidence.json from content YAML (visible only).

This is a second implementation of src/fit/evidence.ts buildEvidencePack: the
browser builds its pack from the generated TS module, while /api/fit fetches
this JSON. They must produce identical docs or the two Fit paths would answer
differently for the same JD — scripts/fit-smoke.ts asserts that parity, so a
change here without a matching change there fails the build.
"""

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
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))
from packages.content.body import body_text  # noqa: E402
from packages.content.paths import corpus_files, is_demo, resolve  # noqa: E402
OUT = ROOT / "dist" / "evidence.json"


def normalize(value: object) -> str:
    """Collapse whitespace the same way evidence.ts does, so claims match."""
    return " ".join(str(value or "").split())


def main() -> int:
    profile = yaml.safe_load(resolve("about", "profile.yaml").read_text(encoding="utf-8")) or {}
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

    for path in corpus_files("work"):
        w = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
        if w.get("visible") is False:
            continue
        # Whole authored statements, preferred over text windows as citations.
        claims = [
            normalize(c)
            for c in [w.get("outcome"), *(w.get("evidence") or [])]
            if normalize(c)
        ]
        docs.append(
            {
                "id": f"work:{w['slug']}",
                "kind": "work",
                "title": w["title"],
                "url": f"/work/{w['slug']}",
                "text": " ".join(
                    part
                    for part in [
                        str(w.get("title") or ""),
                        str(w.get("summary") or "").strip(),
                        body_text(w.get("body")),
                        str(w.get("problem") or "").strip(),
                        *claims,
                        *[str(d).strip() for d in (w.get("decisions") or [])],
                        " ".join(w.get("skills") or []),
                    ]
                    if part
                ),
                "skills": list(w.get("skills") or []),
                "claims": claims,
                "skillNotes": {
                    str(k): normalize(v)
                    for k, v in (w.get("skill_notes") or {}).items()
                    if normalize(v)
                },
            }
        )

    for path in corpus_files("blog"):
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
                        body_text(b.get("body")),
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
