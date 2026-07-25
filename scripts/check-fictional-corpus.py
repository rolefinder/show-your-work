#!/usr/bin/env python3
"""Fail if the demo corpus contains real-person / real-employer fingerprints.

Two directions, both scoped to content/demo/.

NEGATIVE: no real identity may appear in the shipped demo corpus. The patterns
are DERIVED from your own config rather than hardcoded — this file used to
carry a literal list of one maintainer's name and employer, which is
adopter-specific data living in the template's source, exactly what ADR 016
exists to prevent. Anything a regex cannot derive goes in
content/config/corpus-guard.yaml, which ships empty.

POSITIVE: the demo persona must be self-evidently fake. Every route is now
prerendered with Person JSON-LD, so a demo deploy that was never customized
would publish structured data asserting a plausible-sounding human exists. A
name like "Fake Name" fails loudly; a name like "Avery Quill" fails plausibly.
"""

from __future__ import annotations

import re
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
from packages.content.paths import DEMO, is_own, resolve  # noqa: E402


def load_yaml(path) -> dict:
    if not path.is_file():
        return {}
    data = yaml.safe_load(path.read_text(encoding="utf-8"))
    return data if isinstance(data, dict) else {}


GUARD = load_yaml(resolve("config", "corpus-guard.yaml"))

# Email domains the demo corpus may use. RFC 2606 reserves these so they cannot
# belong to a real person.
ALLOWED_EMAIL_DOMAINS = {
    str(d).lower() for d in (GUARD.get("allowed_email_domains") or [])
} or {"example.com", "example.org", "example.net"}


def derived_patterns() -> list[tuple[re.Pattern, str]]:
    """Your identity, taken from your own profile — no list to maintain.

    On a fork this is what actually protects the demo corpus: the moment you
    add content/about/profile.yaml, your name tokens, your email domain and
    your site host become strings the demo corpus may not contain. On the
    template itself there is no profile, so this yields nothing and the
    email-domain rule plus the must-say-fake rule carry the weight.
    """
    if not is_own("about", "profile.yaml"):
        return []
    profile = load_yaml(resolve("about", "profile.yaml"))
    site = load_yaml(resolve("config", "site.yaml"))
    out: list[tuple[re.Pattern, str]] = []

    for token in re.split(r"[^A-Za-z0-9]+", str(profile.get("name") or "")):
        # Two characters is not a fingerprint, it is a coincidence.
        if len(token) > 2:
            out.append((re.compile(rf"\b{re.escape(token)}\b", re.I), "your name"))

    email = str(profile.get("email") or "")
    if "@" in email:
        domain = email.split("@", 1)[1].strip()
        if domain:
            out.append((re.compile(re.escape(domain), re.I), "your email domain"))

    host = str(site.get("origin") or "").split("//")[-1].split("/")[0]
    if host:
        out.append((re.compile(re.escape(host), re.I), "your site host"))
    return out


def forbidden_patterns() -> list[tuple[re.Pattern, str]]:
    """Derived identity, plus anything a regex could not have guessed.

    The literal list that used to live here — a maintainer's name, their
    employer, a vendor — was adopter-specific data sitting in the template's
    source, which is the thing ADR 016 exists to keep out. It also shipped
    those names to every fork. Extras now live in
    content/config/corpus-guard.yaml, which ships empty.
    """
    patterns = derived_patterns()
    for raw in GUARD.get("forbidden") or []:
        term = str(raw).strip()
        if not term:
            continue
        # Word boundaries only where the term starts/ends with a word
        # character: applied blindly, `\bacme.io\b` would never match.
        left = r"\b" if term[:1].isalnum() else ""
        right = r"\b" if term[-1:].isalnum() else ""
        patterns.append(
            (re.compile(left + re.escape(term) + right, re.I), "corpus-guard.yaml `forbidden`")
        )
    return patterns


def check_obviously_fake() -> list[str]:
    """The demo persona and its work must announce themselves as placeholders."""
    problems: list[str] = []
    profile = DEMO / "about" / "profile.yaml"
    if profile.is_file():
        for line in profile.read_text(encoding="utf-8").splitlines():
            if line.startswith("name:") and "fake" not in line.lower():
                problems.append(
                    f"content/demo/about/profile.yaml: demo persona name {line.split(':', 1)[1].strip()!r} "
                    "is not self-evidently fake - a stale demo deploy would publish "
                    "Person JSON-LD for a plausible-sounding human. Use e.g. 'Fake Name'."
                )
    for sub in ("work", "blog"):
        for path in sorted((DEMO / sub).glob("*.yaml")):
            if "fake" not in path.stem.lower():
                problems.append(
                    f"content/demo/{sub}/{path.name}: demo slug is not self-evidently fake "
                    "- prefix it with 'fake-'."
                )
    return problems


def main() -> int:
    if not DEMO.is_dir():
        print("content/demo/ missing", file=sys.stderr)
        return 1

    # Scoped to content/demo/, always. This gate protects the SHIPPED demo
    # corpus from acquiring real-person fingerprints; an adopter's own content
    # is SUPPOSED to name a real person, so scanning it would fail on correct
    # content.
    #
    # It used to scan all of content/ and switch itself off on a `demo: false`
    # flag. That was strictly worse in both directions: the flag was an edit
    # someone had to remember, and once flipped the demo corpus stopped being
    # protected at all. Directory scope needs no flag and never stops.
    failures = check_obviously_fake()
    patterns = forbidden_patterns()

    for path in sorted(DEMO.rglob("*")):
        if not path.is_file():
            continue
        if path.suffix.lower() not in {".yaml", ".yml", ".md", ".txt", ".json"}:
            continue
        if path.name == "corpus-guard.yaml":
            # The guard lists the strings that must not appear, so of course it
            # contains them. Scanning it makes every entry flag itself — and
            # the shipped file's commented examples would flag an adopter who
            # happened to forbid the same term.
            continue
        text = path.read_text(encoding="utf-8")
        rel = path.relative_to(ROOT).as_posix()
        for pat, why in patterns:
            m = pat.search(text)
            if m:
                failures.append(f"{rel}: contains {m.group(0)!r} ({why})")
        for m in re.finditer(r"[\w.+-]+@([\w.-]+\.[a-z]{2,})", text, re.I):
            domain = m.group(1).lower()
            if domain not in ALLOWED_EMAIL_DOMAINS:
                failures.append(f"{rel}: non-demo email domain @{domain}")

    if failures:
        print("fictional-corpus gate FAILED:", file=sys.stderr)
        for f in failures:
            print(f"  - {f}", file=sys.stderr)
        return 1

    print(
        f"fictional-corpus OK (content/demo/ clean and self-evidently fake; "
        f"{len(patterns)} forbidden pattern(s) applied)"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
