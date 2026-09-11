#!/usr/bin/env python3
"""`bun run skills:gap` — what your coursework taught that nothing published shows.

The evidence gate (packages/content/emit_site.py) publishes a course's skill
only when one of its linked projects already claims it. That is the safety
property. This is the other half: the labels it DROPPED.

They are not a gap in a resume. They are a writing queue — work you have
already done, named in the institution's own words rather than from a blank
page. A course taught four things and your published projects demonstrate two;
the other two are the next two things to write up.

Reads content/ directly, so it works before a build and sees what you just
typed. Invisible entries are included deliberately: a course you passed and
have not written up yet is exactly what this is for, and `visible: false` is
where it lives until it earns a page.

Entirely local — no network, nothing written anywhere. Exit 0 always: an
unevidenced label is information, not a failure.

Usage:
  bun run skills:gap          # human-readable
  bun run skills:gap --json   # machine-readable, for a wrapper
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

if "--help" in sys.argv or "-h" in sys.argv:
    print(__doc__)
    raise SystemExit(0)

try:
    import yaml
except ImportError:
    print("skills-gap: PyYAML required - run: pip install --user pyyaml", file=sys.stderr)
    raise SystemExit(2)

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))
from packages.content.paths import corpus_files  # noqa: E402

AS_JSON = "--json" in sys.argv


def load(path: Path) -> dict:
    data = yaml.safe_load(path.read_text(encoding="utf-8"))
    return data if isinstance(data, dict) else {}


def evidenced_skills(work: dict[str, dict], slugs: list[str]) -> set[str]:
    """Every skill claimed by the linked, visible projects — lowercased keys.

    Case-insensitive because check-content.py already blocks two spellings of
    one label, so a case difference is the same label rather than a new one.
    """
    return {
        str(s).strip().lower()
        for slug in slugs
        if work.get(slug, {}).get("visible", True)
        for s in (work.get(slug, {}).get("skills") or [])
    }


work = {}
for path in corpus_files("work"):
    data = load(path)
    work[str(data.get("slug") or path.stem)] = data

rows: list[dict] = []
for kind in ("courses", "certifications"):
    for path in corpus_files(kind):
        data = load(path)
        slugs = [str(s).strip() for s in (data.get("projects") or []) if str(s).strip()]
        evidenced = evidenced_skills(work, slugs)
        taught = [str(t).strip() for t in (data.get("taught") or []) if str(t).strip()]
        rows.append(
            {
                "kind": kind,
                "slug": str(data.get("slug") or path.stem),
                "label": (
                    f"{data.get('code')} — {data.get('name')}"
                    if kind == "courses"
                    else str(data.get("name") or path.stem)
                ),
                "where": " · ".join(
                    str(x)
                    for x in (
                        [data.get("institution"), data.get("completed")]
                        if kind == "courses"
                        else [data.get("issuer"), data.get("earned")]
                    )
                    if x
                ),
                "visible": bool(data.get("visible", True)),
                "published": [t for t in taught if t.lower() in evidenced],
                "unevidenced": [t for t in taught if t.lower() not in evidenced],
                "outcomes": [" ".join(str(o).split()) for o in (data.get("outcomes") or []) if str(o).strip()],
                "projects": slugs,
            }
        )

if AS_JSON:
    print(json.dumps({"rows": rows}, indent=2, ensure_ascii=False))
    raise SystemExit(0)

gaps = [r for r in rows if r["unevidenced"]]
total = sum(len(r["unevidenced"]) for r in gaps)

if not rows:
    print(
        "skills:gap — nothing to read.\n"
        "  Add a course in content/courses/<slug>.yaml with the learning outcomes\n"
        "  quoted from its syllabus, or a credential in content/certifications/."
    )
    raise SystemExit(0)

if not gaps:
    print(
        f"skills:gap — every label taught across {len(rows)} entr"
        f"{'y' if len(rows) == 1 else 'ies'} is demonstrated by published work. "
        "Nothing queued."
    )
    raise SystemExit(0)

print(
    f"skills:gap — {total} label{'' if total == 1 else 's'} taught across "
    f"{len(gaps)} entr{'y' if len(gaps) == 1 else 'ies'}, with nothing published to show for "
    f"{'it' if total == 1 else 'them'}\n"
)

for r in gaps:
    draft = "" if r["visible"] else "  (not published yet)"
    print(f"{r['label']}{draft}")
    if r["where"]:
        print(f"  {r['where']}")
    if r["published"]:
        print(f"  published:   {' · '.join(r['published'])}")
    else:
        print(f"  published:   — nothing yet{'' if r['projects'] else ' (no projects linked)'}")
    print(f"  no evidence: {' · '.join(r['unevidenced'])}")
    if r["outcomes"]:
        # The institution's own sentences, so the write-up starts from their
        # words rather than a blank page. Quoted, never paraphrased.
        print("  the syllabus says:")
        for o in r["outcomes"]:
            print(f"    - {o}")
    print("")

print(
    "Each line above is a thing you were taught and have not shown. Publish work that\n"
    "demonstrates it and tag it with the same label — the gate does the rest."
)
