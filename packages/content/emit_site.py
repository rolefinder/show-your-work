"""Emit content/*.yaml into src/generated/content.ts (typed module, not splice)."""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

try:
    import yaml
except ImportError as exc:  # pragma: no cover
    raise SystemExit("PyYAML required: pip install --user pyyaml") from exc

from .body import BLOCK_KEYS, BodyError
from .body import normalize as normalize_body
from .paths import ROOT, corpus_dir, is_demo, is_own, rel, resolve

ABOUT = resolve("about", "profile.yaml")
SKILLS_CFG = resolve("config", "skills.yaml")
SITE_CFG = resolve("config", "site.yaml")
WORK_DIR = corpus_dir("work")
BLOG_DIR = corpus_dir("blog")
OUT = ROOT / "src" / "generated" / "content.ts"


def ts_string(s: str) -> str:
    return json.dumps(s, ensure_ascii=False)


def ts_string_array(items: list[str]) -> str:
    return "[" + ", ".join(ts_string(x) for x in items) + "]"


def ts_body(value: Any) -> str:
    """Authored `body:` -> a BodyBlock[] literal.

    Normalization happens here, at the emit boundary, so the browser only ever
    sees the array form and no runtime code has to re-handle "string or list".
    """
    blocks = normalize_body(value)
    if not blocks:
        return "[]"

    parts: list[str] = []
    for block in blocks:
        if isinstance(block, str):
            parts.append(f"      {ts_string(block)}")
            continue
        if "list" in block:
            fields = [f"list: {ts_string_array(block['list'])}"]
            if block.get("ordered"):
                fields.append("ordered: true")
        else:
            key = next(k for k in block if k in BLOCK_KEYS)
            fields = [f"{key}: {ts_string(block[key])}"]
            fields += [
                f"{extra}: {ts_string(block[extra])}"
                for extra in sorted(BLOCK_KEYS[key])
                if extra in block
            ]
        parts.append("      { " + ", ".join(fields) + " }")
    return "[\n" + ",\n".join(parts) + "\n    ]"


def emit_profile(data: dict[str, Any]) -> str:
    lines = [
        "export const SITE_PROFILE: SiteProfile = {",
        f"  name: {ts_string(data.get('name') or '')},",
        f"  tagline: {ts_string(data.get('tagline') or '')},",
        f"  location: {ts_string(data.get('location') or '')},",
        f"  email: {ts_string(data.get('email') or '')},",
        f"  summary: {ts_string(str(data.get('summary') or '').strip())},",
        f"  skills: {ts_string_array(list(data.get('skills') or []))},",
    ]
    # Profile URLs, keyed by platform. Authoring order is preserved (dicts are
    # ordered), so the adopter controls the order they render in.
    entries = {
        str(k): str(v).strip()
        for k, v in (data.get("links") or {}).items()
        if str(v or "").strip()
    }
    if entries:
        body = ", ".join(f"{ts_string(k)}: {ts_string(v)}" for k, v in entries.items())
        lines.append(f"  links: {{ {body} }},")
    else:
        lines.append("  links: {},")
    lines.append("};")
    return "\n".join(lines)


TARGETS = ("github-pages", "cloudflare-pages")


def deploy_target(cfg: dict[str, Any]) -> str:
    """Where this site deploys. Unknown values fail rather than defaulting.

    A typo here would silently pick the wrong security posture: on the
    cloudflare path the CSP arrives as a response header, on GitHub Pages it
    can only be a <meta http-equiv>, which cannot express frame-ancestors.
    Guessing between those is not a reasonable thing for a build to do.
    """
    value = str((cfg.get("deploy") or {}).get("target") or "github-pages").strip()
    if value not in TARGETS:
        raise SystemExit(
            f"content/config/site.yaml: deploy.target {value!r} is not one of {', '.join(TARGETS)}"
        )
    return value


# site.yaml `theme:` key -> the --rm-* variable it overrides in tokens/colors.css.
THEME_VARS = {
    "accent": "--rm-brand",
    "accent_deep": "--rm-brand-deep",
    "bg": "--rm-bg",
    "fg": "--rm-fg",
}
HEX = re.compile(r"^#[0-9a-fA-F]{6}$")


def emit_theme(cfg: dict[str, Any]) -> str:
    """Adopter palette overrides, validated here so a typo cannot reach CSS.

    A bad value would otherwise be written into tokens/adopter.css verbatim and
    silently do nothing — or worse, break the declaration after it. Rejecting
    it names the key instead."""
    theme = cfg.get("theme") or {}
    out = []
    for key in THEME_VARS:
        value = str(theme.get(key) or "").strip()
        if not value:
            continue
        if not HEX.match(value):
            raise SystemExit(
                f"{rel(SITE_CFG)}: theme.{key} must be a 6-digit hex color like #0f5c4c, got {value!r}"
            )
        camel = key.split("_")[0] + "".join(p.title() for p in key.split("_")[1:])
        out.append(f"{camel}: {ts_string(value)}")
    return "{ " + ", ".join(out) + " }" if out else "{}"


def emit_site_config(cfg: dict[str, Any], origin: str) -> str:
    """Everything that identifies this deployment, for src/ and emit-html."""
    return "\n".join(
        [
            "export const SITE_CONFIG: SiteConfig = {",
            f"  origin: {ts_string(origin)},",
            f"  titleSuffix: {ts_string(str(cfg.get('title_suffix') or ''))},",
            f"  description: {ts_string(str(cfg.get('description') or ''))},",
            f"  shortName: {ts_string(str(cfg.get('short_name') or ''))},",
            f"  themeColor: {ts_string(str(cfg.get('theme_color') or '#ffffff'))},",
            f"  themeColorDark: {ts_string(str(cfg.get('theme_color_dark') or '#000000'))},",
            # DERIVED, not read from config. A `demo: true` key was something
            # an adopter had to remember to flip, and forgetting shipped the
            # "this corpus is fictional" chrome on a real site. It is now true
            # exactly while content/about/profile.yaml has not been added.
            f"  demo: {'true' if is_demo() else 'false'},",
            f"  deployTarget: {ts_string(deploy_target(cfg))},",
            f"  customDomain: {ts_string(str((cfg.get('deploy') or {}).get('custom_domain') or '').strip())},",
            f"  theme: {emit_theme(cfg)},",
            "};",
        ]
    )


def opt_string(key: str, value: Any) -> str:
    """Emit `key: "..."`, or nothing when the field is absent/blank."""
    text = str(value or "").strip()
    return f"    {key}: {ts_string(text)},\n" if text else ""


def opt_string_list(key: str, value: Any) -> str:
    items = [str(v).strip() for v in (value or []) if str(v).strip()]
    return f"    {key}: {ts_string_array(items)},\n" if items else ""


def opt_string_map(key: str, value: Any) -> str:
    # Whitespace-collapsed, not just stripped: scripts/emit-evidence.py
    # normalizes the same values for the Worker's pack, and fit-smoke compares
    # the two. A folded YAML scalar must not produce different strings.
    pairs = {
        str(k): " ".join(str(v).split())
        for k, v in (value or {}).items()
        if str(v or "").strip()
    }
    if not pairs:
        return ""
    body = ", ".join(f"{ts_string(k)}: {ts_string(v)}" for k, v in pairs.items())
    return f"    {key}: {{ {body} }},\n"


def emit_work_item(w: dict[str, Any]) -> str:
    visible = "true" if w.get("visible", True) else "false"
    date = w.get("date")
    date_line = f"    date: {ts_string(str(date))},\n" if date else ""
    return (
        "  {\n"
        f"    slug: {ts_string(w['slug'])},\n"
        f"    title: {ts_string(w.get('title') or w['slug'])},\n"
        f"    summary: {ts_string(str(w.get('summary') or '').strip())},\n"
        f"    body: {ts_body(w.get('body'))},\n"
        f"    skills: {ts_string_array(list(w.get('skills') or []))},\n"
        f"    visible: {visible},\n"
        f"{date_line}"
        f"{opt_string('problem', w.get('problem'))}"
        f"{opt_string('outcome', w.get('outcome'))}"
        f"{opt_string_list('evidence', w.get('evidence'))}"
        f"{opt_string_list('decisions', w.get('decisions'))}"
        f"{opt_string_map('skillNotes', w.get('skill_notes'))}"
        "  }"
    )


def emit_work(items: list[dict[str, Any]]) -> str:
    body = ",\n".join(emit_work_item(w) for w in items)
    return f"export const WORK: WorkItem[] = [\n{body}\n];"


def emit_blog_item(b: dict[str, Any]) -> str:
    visible = "true" if b.get("visible", True) else "false"
    date = b.get("date")
    date_line = f"    date: {ts_string(str(date))},\n" if date else ""
    return (
        "  {\n"
        f"    slug: {ts_string(b['slug'])},\n"
        f"    title: {ts_string(b.get('title') or b['slug'])},\n"
        f"    summary: {ts_string(str(b.get('summary') or '').strip())},\n"
        f"    body: {ts_body(b.get('body'))},\n"
        f"    skills: {ts_string_array(list(b.get('skills') or []))},\n"
        f"    visible: {visible},\n"
        f"{date_line}"
        "  }"
    )


def emit_blog(items: list[dict[str, Any]]) -> str:
    body = ",\n".join(emit_blog_item(b) for b in items)
    return f"export const BLOG: BlogPost[] = [\n{body}\n];"


def emit_skill_categories(data: dict[str, Any]) -> str:
    order = list(data.get("order") or ["Other"])
    fallback = str(data.get("fallback") or "Other")
    raw_map = data.get("map") or {}
    map_lines = ",\n".join(
        f"    {ts_string(k)}: {ts_string(str(v))}" for k, v in raw_map.items()
    )
    descriptions = data.get("descriptions") or {}
    desc_lines = ",\n".join(
        f"    {ts_string(k)}: {ts_string(str(v).strip())}"
        for k, v in descriptions.items()
        if str(v or "").strip()
    )
    desc_block = (
        "  descriptions: {\n" + desc_lines + "\n  },\n" if desc_lines else "  descriptions: {},\n"
    )
    return (
        "export const SKILL_CATEGORIES: SkillCategoryConfig = {\n"
        f"  fallback: {ts_string(fallback)},\n"
        f"  order: {ts_string_array(order)},\n"
        "  map: {\n"
        f"{map_lines}\n"
        "  },\n"
        f"{desc_block}"
        "};"
    )


def load_yaml_dir(directory: Path) -> list[dict[str, Any]]:
    items: list[dict[str, Any]] = []
    for path in sorted(directory.glob("*.yaml")):
        raw = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
        if raw.get("slug") != path.stem:
            raise SystemExit(f"{path.name}: slug must match filename")
        # Validate the body here rather than letting ts_body raise mid-emit: a
        # bare traceback naming an index in a list nobody can see is the
        # failure mode platform-review-2026-07 P2(c) called out.
        try:
            normalize_body(raw.get("body"))
        except BodyError as exc:
            raise SystemExit(f"{rel(path)}: {exc}") from exc
        items.append(raw)
    return items


def load_corpus() -> tuple[dict[str, Any], list[dict[str, Any]], list[dict[str, Any]], dict[str, Any], dict[str, Any]]:
    profile = yaml.safe_load(ABOUT.read_text(encoding="utf-8")) or {}
    skills_cfg = (
        yaml.safe_load(SKILLS_CFG.read_text(encoding="utf-8")) or {}
        if SKILLS_CFG.exists()
        else {"order": ["Other"], "map": {}, "fallback": "Other"}
    )
    site_cfg = (
        yaml.safe_load(SITE_CFG.read_text(encoding="utf-8")) or {}
        if SITE_CFG.exists()
        else {"origin": "https://example.com"}
    )
    return profile, load_yaml_dir(WORK_DIR), load_yaml_dir(BLOG_DIR), skills_cfg, site_cfg


def render_module(
    profile: dict[str, Any],
    work: list[dict[str, Any]],
    blog: list[dict[str, Any]],
    skills_cfg: dict[str, Any],
    site_cfg: dict[str, Any],
) -> str:
    header = (
        "/* AUTO-GENERATED by packages/content — do not edit by hand.\n"
        "   Source: content/about, content/work, content/blog, content/config/skills.yaml,\n"
        "   content/config/site.yaml\n"
        "   Regenerate: npm run emit\n"
        "*/\n"
        'import type { BlogPost, SiteConfig, SiteProfile, WorkItem } from "../types";\n'
        'import type { SkillCategoryConfig } from "../skills/SkillBank";\n'
        "\n"
    )
    origin = str(site_cfg.get("origin") or "https://example.com").rstrip("/")
    parts = [
        header,
        f"export const SITE_ORIGIN = {ts_string(origin)};",
        "",
        emit_site_config(site_cfg, origin),
        "",
        emit_profile(profile),
        "",
        emit_work(work),
        "",
        emit_blog(blog),
        "",
        emit_skill_categories(skills_cfg),
        "",
    ]
    return "\n".join(parts)


def emit_generated_module(*, dry_run: bool = False) -> str:
    profile, work, blog, skills_cfg, site_cfg = load_corpus()
    text = render_module(profile, work, blog, skills_cfg, site_cfg)
    if dry_run:
        return text
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(text, encoding="utf-8", newline="\n")
    return (
        f"emitted profile + {len(work)} work + {len(blog)} blog "
        f"+ skill categories -> {OUT.relative_to(ROOT)}"
    )
