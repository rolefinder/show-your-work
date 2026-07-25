"""Where content comes from: yours if you wrote it, the demo's if you have not.

The design rule this exists to enforce: **an adopter only ever ADDS files.**
Nothing in the template is edited, nothing is deleted. `content/demo/` is the
shipped corpus and is read-only in spirit; you write `content/config/site.yaml`,
`content/about/profile.yaml`, `content/work/*.yaml`, and each one you add takes
over from its demo counterpart.

Two resolution rules, and the difference between them matters:

  FILES  fall back whole. If you add site.yaml, the demo's site.yaml is not
         consulted at all — not even for keys you left out. Falling back
         key-by-key would put "Fake Name" in YOUR page titles, which is the
         messy-site outcome this whole scheme exists to avoid. Missing keys
         become empty, and the site is incomplete instead. `check-ready` names
         each one.

  CORPORA switch wholesale. One project in content/work/ means the demo
         projects are gone from the site — not merged, not appended. A
         portfolio that lists two of your projects and two fictional ones is
         worse than one that lists two.

Demo mode is DERIVED, never declared: the site is a demo exactly when identity
still resolves to content/demo/. There is no flag to forget to flip.
"""

from __future__ import annotations

import os
from pathlib import Path

# RM_ROOT exists so scripts/check-parity.mjs can point both resolvers at a
# fixture tree and assert they agree. Nothing in the build sets it.
ROOT = Path(os.environ.get("RM_ROOT") or Path(__file__).resolve().parents[2])
CONTENT = ROOT / "content"
DEMO = CONTENT / "demo"


def resolve(*parts: str) -> Path:
    """The adopter's copy of a config file if present, else the demo's."""
    own = CONTENT.joinpath(*parts)
    return own if own.is_file() else DEMO.joinpath(*parts)


def is_own(*parts: str) -> bool:
    """True when the adopter supplied this file themselves."""
    return CONTENT.joinpath(*parts).is_file()


def corpus_dir(kind: str) -> Path:
    """`content/<kind>/` once it holds any YAML, otherwise `content/demo/<kind>/`."""
    own = CONTENT / kind
    if own.is_dir() and any(own.glob("*.yaml")):
        return own
    return DEMO / kind


def corpus_files(kind: str) -> list[Path]:
    d = corpus_dir(kind)
    return sorted(d.glob("*.yaml")) if d.is_dir() else []


def is_demo() -> bool:
    """
    Is this still the template rather than somebody's site?

    Keyed on the profile alone. That file carries the name, tagline and email
    that appear on every page and in every JSON-LD `Person` block, so if it is
    still the demo's, the deployment is a demo whatever else has been added.
    """
    return not is_own("about", "profile.yaml")


def rel(path: Path) -> str:
    """Repo-relative, forward-slashed — for messages that name a file."""
    return path.relative_to(ROOT).as_posix()
