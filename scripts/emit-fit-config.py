#!/usr/bin/env python3
"""Emit content/config/fit.yaml -> dist/fit-config.json for runtime/tests.

Platform review P1. This file used to json.dumps the YAML straight through,
which meant fit.yaml's keys had to already match the TypeScript FitMatchConfig
- so it was the one config authored in camelCase while site.yaml, work/*.yaml
and the rest are snake_case. Three conventions in one directory, with no way
for an adopter to tell which file wanted which, and a snake_case guess in
fit.yaml was silently ignored.

Now the YAML is authored in snake_case like everything else and translated
here, at the emit boundary, the way emit_site.py already translates for every
other config. The old camelCase keys are still accepted for one release and
warn, so existing forks keep working.

Usage: python scripts/emit-fit-config.py [--help]
Exit 0 = ok | 1 = bad config | 2 = setup problem.
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
    print("emit-fit-config: PyYAML required - run: pip install --user pyyaml", file=sys.stderr)
    raise SystemExit(2)

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))
from packages.content.paths import corpus_files, is_demo, resolve  # noqa: E402
SRC = resolve("config", "fit.yaml")
OUT = ROOT / "dist" / "fit-config.json"

# Authored key (snake_case) -> FitMatchConfig field (camelCase).
KEY_MAP = {
    "extra_stops": "extraStops",
    "skill_weights": "skillWeights",
    "extra_caveats": "extraCaveats",
    "show_gaps": "showGaps",
    # Already identical in both conventions.
    "synonyms": "synonyms",
    "weights": "weights",
}
# Deprecated camelCase spellings, accepted for one release.
LEGACY = {v: v for v in KEY_MAP.values() if v not in KEY_MAP}


def translate(data: dict) -> tuple[dict, list[str]]:
    out: dict = {}
    notes: list[str] = []
    for key, value in data.items():
        if key in KEY_MAP:
            out[KEY_MAP[key]] = value
        elif key in LEGACY:
            out[key] = value
            snake = next(k for k, v in KEY_MAP.items() if v == key)
            notes.append(
                f"`{key}` is the old camelCase spelling; rename it to `{snake}`. "
                "Accepted for now, removed in a future release."
            )
        else:
            out[key] = value
            notes.append(f"unknown key `{key}` passed through untouched - typo?")
    return out, notes


def main() -> int:
    if not SRC.is_file():
        print(f"emit-fit-config: missing {SRC.relative_to(ROOT).as_posix()}", file=sys.stderr)
        return 1
    try:
        raw = yaml.safe_load(SRC.read_text(encoding="utf-8"))
    except yaml.YAMLError as exc:
        print(f"emit-fit-config: invalid YAML in fit.yaml - {exc}", file=sys.stderr)
        return 1
    if raw is None:
        raw = {}
    if not isinstance(raw, dict):
        print(
            f"emit-fit-config: fit.yaml must be a mapping, got {type(raw).__name__}",
            file=sys.stderr,
        )
        return 1

    data, notes = translate(raw)
    for n in notes:
        print(f"emit-fit-config: WARN  {n}", file=sys.stderr)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
    print(f"emit-fit-config: ok - wrote {OUT.relative_to(ROOT).as_posix()} ({len(data)} keys)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
