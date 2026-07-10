#!/usr/bin/env python3
"""Emit content/*.yaml into src/app.tsx SITE_PROFILE / WORK / BLOG blocks."""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Any

try:
    import yaml
except ImportError:
    print("PyYAML required: pip install --user pyyaml", file=sys.stderr)
    sys.exit(1)

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / "src" / "app.tsx"
ABOUT = ROOT / "content" / "about" / "profile.yaml"
SKILLS_CFG = ROOT / "content" / "config" / "skills.yaml"
WORK_DIR = ROOT / "content" / "work"
BLOG_DIR = ROOT / "content" / "blog"

BEGIN_RE = {
    "SITE_PROFILE": re.compile(
        r"/\* BEGIN SITE_PROFILE \*/.*?/\* END SITE_PROFILE \*/", re.DOTALL
    ),
    "WORK": re.compile(r"/\* BEGIN WORK \*/.*?/\* END WORK \*/", re.DOTALL),
    "BLOG": re.compile(r"/\* BEGIN BLOG \*/.*?/\* END BLOG \*/", re.DOTALL),
    "SKILL_CATEGORIES": re.compile(
        r"/\* BEGIN SKILL_CATEGORIES \*/.*?/\* END SKILL_CATEGORIES \*/", re.DOTALL
    ),
}


def ts_string(s: str) -> str:
    return json.dumps(s, ensure_ascii=False)


def ts_string_array(items: list[str]) -> str:
    return "[" + ", ".join(ts_string(x) for x in items) + "]"


def emit_profile(data: dict[str, Any]) -> str:
    lines = [
        "/* BEGIN SITE_PROFILE */",
        "const SITE_PROFILE: SiteProfile = {",
        f"  name: {ts_string(data['name'])},",
        f"  tagline: {ts_string(data['tagline'])},",
        f"  location: {ts_string(data['location'])},",
        f"  email: {ts_string(data['email'])},",
        f"  summary: {ts_string(str(data['summary']).strip())},",
        f"  skills: {ts_string_array(list(data.get('skills') or []))},",
        "};",
        "/* END SITE_PROFILE */",
    ]
    return "\n".join(lines)


def emit_work_item(w: dict[str, Any]) -> str:
    visible = "true" if w.get("visible", True) else "false"
    date = w.get("date")
    date_line = f"    date: {ts_string(str(date))},\n" if date else ""
    return (
        "  {\n"
        f"    slug: {ts_string(w['slug'])},\n"
        f"    title: {ts_string(w['title'])},\n"
        f"    summary: {ts_string(str(w['summary']).strip())},\n"
        f"    body: {ts_string(str(w['body']).strip())},\n"
        f"    skills: {ts_string_array(list(w.get('skills') or []))},\n"
        f"    visible: {visible},\n"
        f"{date_line}"
        "  }"
    )


def emit_work(items: list[dict[str, Any]]) -> str:
    body = ",\n".join(emit_work_item(w) for w in items)
    return (
        "/* BEGIN WORK */\n"
        "const WORK: WorkItem[] = [\n"
        f"{body}\n"
        "];\n"
        "/* END WORK */"
    )


def emit_blog_item(b: dict[str, Any]) -> str:
    visible = "true" if b.get("visible", True) else "false"
    date = b.get("date")
    date_line = f"    date: {ts_string(str(date))},\n" if date else ""
    return (
        "  {\n"
        f"    slug: {ts_string(b['slug'])},\n"
        f"    title: {ts_string(b['title'])},\n"
        f"    summary: {ts_string(str(b['summary']).strip())},\n"
        f"    body: {ts_string(str(b['body']).strip())},\n"
        f"    skills: {ts_string_array(list(b.get('skills') or []))},\n"
        f"    visible: {visible},\n"
        f"{date_line}"
        "  }"
    )


def emit_blog(items: list[dict[str, Any]]) -> str:
    body = ",\n".join(emit_blog_item(b) for b in items)
    return (
        "/* BEGIN BLOG */\n"
        "const BLOG: BlogPost[] = [\n"
        f"{body}\n"
        "];\n"
        "/* END BLOG */"
    )


def emit_skill_categories(data: dict[str, Any]) -> str:
    order = list(data.get("order") or ["Other"])
    fallback = str(data.get("fallback") or "Other")
    raw_map = data.get("map") or {}
    map_lines = ",\n".join(
        f"    {ts_string(k)}: {ts_string(str(v))}" for k, v in raw_map.items()
    )
    return (
        "/* BEGIN SKILL_CATEGORIES */\n"
        "const SKILL_CATEGORIES: SkillCategoryConfig = {\n"
        f"  fallback: {ts_string(fallback)},\n"
        f"  order: {ts_string_array(order)},\n"
        "  map: {\n"
        f"{map_lines}\n"
        "  },\n"
        "};\n"
        "/* END SKILL_CATEGORIES */"
    )


def load_work() -> list[dict[str, Any]]:
    items: list[dict[str, Any]] = []
    for path in sorted(WORK_DIR.glob("*.yaml")):
        raw = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
        if raw.get("slug") != path.stem:
            raise SystemExit(f"{path.name}: slug must match filename")
        items.append(raw)
    return items


def load_blog() -> list[dict[str, Any]]:
    items: list[dict[str, Any]] = []
    for path in sorted(BLOG_DIR.glob("*.yaml")):
        raw = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
        if raw.get("slug") != path.stem:
            raise SystemExit(f"{path.name}: slug must match filename")
        items.append(raw)
    return items


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    profile = yaml.safe_load(ABOUT.read_text(encoding="utf-8")) or {}
    skills_cfg = (
        yaml.safe_load(SKILLS_CFG.read_text(encoding="utf-8")) or {}
        if SKILLS_CFG.exists()
        else {"order": ["Other"], "map": {}, "fallback": "Other"}
    )
    work = load_work()
    blog = load_blog()

    text = APP.read_text(encoding="utf-8")
    replacements = {
        "SITE_PROFILE": emit_profile(profile),
        "WORK": emit_work(work),
        "BLOG": emit_blog(blog),
        "SKILL_CATEGORIES": emit_skill_categories(skills_cfg),
    }
    for key, block in replacements.items():
        if not BEGIN_RE[key].search(text):
            raise SystemExit(f"marker not found for {key}")
        text = BEGIN_RE[key].sub(block, text, count=1)

    if args.dry_run:
        print(text)
        return 0

    APP.write_text(text, encoding="utf-8", newline="\n")
    print(
        f"emitted profile + {len(work)} work + {len(blog)} blog "
        f"+ skill categories -> {APP.relative_to(ROOT)}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
