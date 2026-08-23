#!/usr/bin/env python3
"""Draft the empty sections of a LinkedIn profile from your published work (stdout only).

Platform profiles sit empty not because there is no API but because the person
does not know what to put in them. The hard part was never the transport.

LinkedIn gives you a data export, on request, as a member. That export states
exactly which sections of your profile are blank. This diffs it against your
published corpus and drafts copy for the BLANKS ONLY — an About paragraph from
your summary and your project outcomes, a role description from that role's
highlights — then prints it and stops.

You read it, edit it, and paste what you want.

WHY IT STOPS AT THE CLIPBOARD, and this is a feature rather than a limitation:

  - Writing into your profile needs a stored credential for an account you own.
    AGENTS.md: never handle a credential. This holds none, asks for none, and
    could not use one.
  - It would put your own account at terms-of-service risk during a job search,
    which is the worst possible week to have a profile restricted.
  - The last review before something becomes a public claim about a person
    should be done by that person.

The official export archive only. No scrapers, no Voyager, no cookie bots — see
the Recruiter Fit PRD §8, which put those out of supported scope.

Every drafted sentence traces to something you already wrote and published.
Where the corpus says nothing, you get a `TODO:` naming what is missing. Nothing
is generated to fill space, and nothing leaves this machine: no network call is
made, and no file is written.

Usage:
  python packages/ingest/from-linkedin-export.py Basic_LinkedIn_DataExport.zip
  python packages/ingest/from-linkedin-export.py ./unzipped-export/
  python packages/ingest/from-linkedin-export.py export.zip --all   # ignore emptiness
"""

from __future__ import annotations

import argparse
import csv
import io
import re
import sys
import zipfile
from pathlib import Path

try:
    import yaml
except ImportError:
    print("PyYAML required: pip install --user pyyaml", file=sys.stderr)
    raise SystemExit(2)

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))
from packages.content.paths import corpus_files, resolve  # noqa: E402

# LinkedIn has renamed columns before and will again, so nothing here depends on
# one spelling. Each field lists the headers seen in the wild, matched
# case-insensitively and whitespace-insensitively. When none matches, the tool
# says which file and which candidates it looked for — an honest "I could not
# read this" beats an empty draft that looks like "you have nothing to add".
PROFILE_SUMMARY = ("summary", "about")
POSITION_COMPANY = ("company name", "company", "organization")
POSITION_TITLE = ("title", "position", "role")
POSITION_DESC = ("description", "summary")


def norm(text: object) -> str:
    return re.sub(r"[^a-z0-9]+", " ", str(text or "").lower()).strip()


class Export:
    """The CSVs in an export, from a .zip or an unzipped directory."""

    def __init__(self, path: Path):
        self.path = path
        self.tables: dict[str, list[dict[str, str]]] = {}
        if path.is_dir():
            for f in sorted(path.rglob("*.csv")):
                self.tables[f.name.lower()] = self._rows(f.read_bytes())
        elif zipfile.is_zipfile(path):
            with zipfile.ZipFile(path) as z:
                for name in z.namelist():
                    if name.lower().endswith(".csv"):
                        self.tables[Path(name).name.lower()] = self._rows(z.read(name))
        else:
            raise SystemExit(
                f"{path}: not a .zip and not a directory.\n"
                "  Request your export at LinkedIn → Settings → Data privacy → "
                "Get a copy of your data, then pass the archive it emails you."
            )

    @staticmethod
    def _rows(raw: bytes) -> list[dict[str, str]]:
        # utf-8-sig: LinkedIn's CSVs carry a BOM, which would otherwise become
        # part of the first header name and break every lookup on it.
        text = raw.decode("utf-8-sig", errors="replace")
        return [
            {(k or "").strip(): (v or "").strip() for k, v in row.items()}
            for row in csv.DictReader(io.StringIO(text))
        ]

    def table(self, *names: str) -> list[dict[str, str]]:
        for n in names:
            if n.lower() in self.tables:
                return self.tables[n.lower()]
        return []


def column(row: dict[str, str], candidates: tuple[str, ...]) -> str | None:
    """The first candidate header present in this row, matched loosely."""
    lookup = {norm(k): k for k in row}
    for c in candidates:
        if norm(c) in lookup:
            return lookup[norm(c)]
    return None


def load_corpus() -> dict:
    profile = yaml.safe_load(resolve("about", "profile.yaml").read_text(encoding="utf-8")) or {}
    def items(kind: str) -> list[dict]:
        out = []
        for p in corpus_files(kind):
            d = yaml.safe_load(p.read_text(encoding="utf-8")) or {}
            if d.get("visible", True):
                out.append(d)
        return out
    return {"profile": profile, "work": items("work"), "experience": items("experience")}


def draft_about(corpus: dict) -> list[str]:
    """An About paragraph, assembled only from published sentences."""
    profile = corpus["profile"]
    lines: list[str] = []
    summary = " ".join(str(profile.get("summary") or "").split())
    if summary:
        lines.append(summary)
    else:
        lines.append("TODO: content/about/profile.yaml has no `summary:` — write that first; this draft is built from it.")

    outcomes = [
        " ".join(str(w.get("outcome")).split())
        for w in corpus["work"]
        if str(w.get("outcome") or "").strip()
    ]
    if outcomes:
        lines.append("")
        lines.append("Recent work:")
        for o in outcomes[:3]:
            lines.append(f"  - {o}")
    else:
        lines.append("")
        lines.append("TODO: no published project defines `outcome:` — there is nothing to say here that you have already said somewhere a reader can check.")
    return lines


def draft_role(role: dict) -> list[str]:
    """A role description, assembled only from that role's own published lines."""
    lines: list[str] = []
    summary = " ".join(str(role.get("summary") or "").split())
    if summary:
        lines.append(summary)
    highlights = [" ".join(str(h).split()) for h in (role.get("highlights") or []) if str(h).strip()]
    if highlights:
        if summary:
            lines.append("")
        lines.extend(f"  - {h}" for h in highlights)
    if not lines:
        lines.append(f"TODO: content/experience/{role.get('slug')}.yaml has no summary or highlights to draft from.")
    return lines


def match_role(company: str, title: str, roles: list[dict]) -> dict | None:
    """The corpus role this LinkedIn position refers to, or None.

    Organization AND role first, organization alone second. Matched on
    normalized text rather than exactly: "Fake Platform Co." and "Fake Platform
    Co" are one employer, and no one should have to make them agree by hand.
    """
    c, t = norm(company), norm(title)
    for r in roles:
        if norm(r.get("organization")) == c and norm(r.get("role")) == t:
            return r
    for r in roles:
        if c and norm(r.get("organization")) == c:
            return r
    return None


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("export", type=Path, help="The export .zip, or a directory you unzipped it into")
    p.add_argument("--all", action="store_true", help="Draft every section, not only the empty ones")
    args = p.parse_args()

    export = Export(args.export)
    corpus = load_corpus()
    roles = corpus["experience"]

    print("# DRAFT — read it, edit it, paste what you want.")
    print("#")
    print("# Nothing was sent anywhere and nothing was written. Every sentence below")
    print("# came from your own published content; a TODO means the corpus is silent.")
    print("")

    drafted = 0
    skipped: list[str] = []

    # ---- About ----
    profile_rows = export.table("Profile.csv")
    if not profile_rows:
        print("## About")
        print("Could not read Profile.csv from the export. Looked for a file of that name;")
        print(f"found: {', '.join(sorted(export.tables)) or 'no CSVs at all'}.")
        print("")
    else:
        row = profile_rows[0]
        key = column(row, PROFILE_SUMMARY)
        if key is None:
            print("## About")
            print(f"Profile.csv has no column named any of {list(PROFILE_SUMMARY)} — LinkedIn may have")
            print(f"renamed it. Columns present: {', '.join(sorted(row)) or 'none'}.")
            print("")
        elif row[key].strip() and not args.all:
            skipped.append("About — already written on LinkedIn")
        else:
            print("## About")
            for line in draft_about(corpus):
                print(line)
            print("")
            drafted += 1

    # ---- Positions ----
    position_rows = export.table("Positions.csv")
    if not position_rows:
        print("## Experience")
        print("Could not read Positions.csv from the export.")
        print("")
    for row in position_rows:
        c_key = column(row, POSITION_COMPANY)
        t_key = column(row, POSITION_TITLE)
        d_key = column(row, POSITION_DESC)
        company = row.get(c_key or "", "")
        title = row.get(t_key or "", "")
        label = " at ".join(x for x in (title, company) if x) or "an unnamed position"
        if d_key and row[d_key].strip() and not args.all:
            skipped.append(f"{label} — already described on LinkedIn")
            continue
        role = match_role(company, title, roles)
        print(f"## Experience — {label}")
        if role is None:
            print(f"TODO: nothing in content/experience/ matches {label!r}.")
            print("      Add it there first — this drafts from published work, it does not")
            print("      write the work for you.")
        else:
            for line in draft_role(role):
                print(line)
            drafted += 1
        print("")

    if skipped:
        print("## Left alone")
        print("# Already filled in on LinkedIn. Pass --all to draft these too.")
        for s in skipped:
            print(f"  - {s}")
        print("")

    print(f"# {drafted} section(s) drafted. Nothing published, nothing stored, nothing sent.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
