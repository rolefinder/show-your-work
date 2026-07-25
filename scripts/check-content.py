#!/usr/bin/env python3
"""Validate content/ before it can become a published page.

Platform review P2: the only rule enforced anywhere was slug == filename, and
three classes of authoring error built completely green. Each check below
exists because the failure was reproduced against main:

  1. A dangling cross-link ({{blog:does-not-exist|...}}) built clean and
     prerendered a live href into a project page, pointing at a path absent
     from known-paths.json - a 404 on your own portfolio, reachable by a
     recruiter, with nothing warning you.
  2. A one-character skill typo (TypeScript -> Typescript) silently forked the
     taxonomy: both spellings survived, the typo fell into "Other", and it
     split the skill bank, the graph, search, and Fit's heaviest signal.
  3. A missing required field raised a raw KeyError traceback from inside
     emit_site.py, for the most common authoring mistake there is.

Blocks on (1) and (3), which are unambiguously broken. Warns on (2), because a
genuinely new skill is legitimate and only the author can tell the difference.

Usage: python scripts/check-content.py [--help]
Exit 0 = clean (warnings may still print) | 1 = content errors | 2 = setup.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

if "--help" in sys.argv or "-h" in sys.argv:
    print(__doc__)
    raise SystemExit(0)

try:
    import yaml
except ImportError:
    print("check-content: PyYAML required - run: pip install --user pyyaml", file=sys.stderr)
    raise SystemExit(2)

ROOT = Path(__file__).resolve().parents[1]
CONTENT = ROOT / "content"

REQUIRED = {
    "work": ["slug", "title", "summary", "body", "skills"],
    "blog": ["slug", "title", "summary", "body", "skills"],
}
PROFILE_REQUIRED = ["name", "tagline", "location", "email", "summary", "skills"]

# {{work:slug|Label}} / {{blog:...}} / {{post:...}} - mirrors src/search/richText.tsx
TOKEN = re.compile(r"\{\{(work|blog|post):([a-z0-9-]+)\|([^}]+)\}\}")
DATE = re.compile(r"^\d{4}-\d{2}(-\d{2})?$")

errors: list[str] = []
warnings: list[str] = []


def load(path: Path) -> dict | None:
    try:
        data = yaml.safe_load(path.read_text(encoding="utf-8"))
    except yaml.YAMLError as exc:
        errors.append(f"{path.relative_to(ROOT).as_posix()}: invalid YAML - {exc}")
        return None
    if not isinstance(data, dict):
        errors.append(
            f"{path.relative_to(ROOT).as_posix()}: expected a mapping at the top level, "
            f"got {type(data).__name__}"
        )
        return None
    return data


def collect(kind: str) -> dict[str, dict]:
    out: dict[str, dict] = {}
    directory = CONTENT / kind
    if not directory.is_dir():
        return out
    for path in sorted(directory.glob("*.yaml")):
        rel = path.relative_to(ROOT).as_posix()
        data = load(path)
        if data is None:
            continue
        for field in REQUIRED[kind]:
            if field not in data or data[field] in (None, "", []):
                errors.append(f"{rel}: missing required field `{field}`")
        if data.get("slug") != path.stem:
            errors.append(
                f"{rel}: slug is {data.get('slug')!r} but the filename says {path.stem!r} - "
                "they must match, or cross-links break"
            )
        date = data.get("date")
        if date is not None and not DATE.match(str(date)):
            errors.append(f"{rel}: date {date!r} is not YYYY-MM or YYYY-MM-DD")
        out[str(data.get("slug") or path.stem)] = data
    return out


work = collect("work")
blog = collect("blog")

# ---------- cross-links resolve ----------
known = {"work": set(work), "blog": set(blog)}
for kind, items in (("work", work), ("blog", blog)):
    for slug, data in items.items():
        for field in ("summary", "body"):
            for m in TOKEN.finditer(str(data.get(field) or "")):
                target_kind = "blog" if m.group(1) in ("blog", "post") else "work"
                target = m.group(2)
                if target not in known[target_kind]:
                    errors.append(
                        f"content/{kind}/{slug}.yaml: {field} links to "
                        f"{{{{{m.group(1)}:{target}}}}} but content/{target_kind}/{target}.yaml "
                        "does not exist - this publishes a link that 404s"
                    )

# ---------- skill vocabulary ----------
profile_path = CONTENT / "about" / "profile.yaml"
profile = load(profile_path) if profile_path.is_file() else None
if profile is not None:
    for field in PROFILE_REQUIRED:
        if field not in profile or profile[field] in (None, "", []):
            errors.append(f"content/about/profile.yaml: missing required field `{field}`")

used: dict[str, list[str]] = {}
for kind, items in (("work", work), ("blog", blog)):
    for slug, data in items.items():
        for s in data.get("skills") or []:
            used.setdefault(str(s), []).append(f"content/{kind}/{slug}.yaml")

# Near-duplicates: same skill differing only by case or punctuation is almost
# always a typo, and it forks the taxonomy silently.
buckets: dict[str, set[str]] = {}
for label in used:
    key = re.sub(r"[^a-z0-9]", "", label.lower())
    buckets.setdefault(key, set()).add(label)
for key, variants in sorted(buckets.items()):
    if len(variants) > 1:
        listed = ", ".join(f"{v!r}" for v in sorted(variants))
        errors.append(
            f"content/: skill spelled {len(variants)} ways - {listed}. "
            "These become separate chips, graph nodes and search entries, and split "
            "Fit's skill weighting. Pick one."
        )

skills_cfg_path = CONTENT / "config" / "skills.yaml"
skills_cfg = load(skills_cfg_path) if skills_cfg_path.is_file() else None
if isinstance(skills_cfg, dict):
    mapped = set(skills_cfg.get("map") or {})
    for label, where in sorted(used.items()):
        if label not in mapped:
            warnings.append(
                f"skill {label!r} is not in content/config/skills.yaml `map` - it will "
                f"fall into the fallback category (used by {where[0]})"
            )

# ---------- report ----------
for w in warnings:
    print(f"check-content: WARN  {w}", file=sys.stderr)
if errors:
    print("check-content: FAILED", file=sys.stderr)
    for e in errors:
        print(f"  - {e}", file=sys.stderr)
    raise SystemExit(1)

print(
    f"check-content: ok ({len(work)} work, {len(blog)} blog, {len(used)} skills"
    + (f", {len(warnings)} warning(s)" if warnings else "")
    + ")"
)
