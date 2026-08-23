# Ingest helpers

Draft generators that emit YAML **for human review** before copying into
`content/`. They never write production content automatically.

| Script | Input | Output |
|--------|-------|--------|
| `from-resume-text.py` | Plain-text resume | Draft `work` / `about` YAML snippets |
| `from-github.py` | Public GitHub username | Draft project stubs via GitHub API |
| `from-syllabus-text.py` | Plain-text course syllabus | Draft `courses` YAML — outcomes verbatim, `taught:` as TODO |
| `from-linkedin-export.py` | Official LinkedIn data export | Draft copy for the profile sections you left blank |

## Why `taught:` comes back empty

`from-syllabus-text.py` extracts the learning-outcomes list and stops. Turning
"design a normalized relational schema" into the label `normalisation` is a
paraphrase, and these scripts never paraphrase a source — anything it does not
state becomes a `TODO:`.

Naming the skill is yours. Publishing it is not: the build drops any label that
none of the course's linked projects already claims (ADR 032), so a name you get
wrong costs you a line in `bun run skills:gap`, not a false claim on your site.

## LinkedIn

Official **data-export ZIP → parser** only. No scrapers, Voyager, or cookie bots.

```bash
bun run profile:draft ~/Downloads/Basic_LinkedIn_DataExport.zip
```

The export states which sections of your profile are blank. The parser diffs
that against your published corpus, drafts copy for the blanks only, prints it,
and stops.

**It stops at the clipboard, not the credential**, and that boundary is the
feature rather than a missing half:

- writing into your profile needs a stored credential for an account you own,
  and AGENTS.md says never handle one;
- it puts your own account at terms-of-service risk during a job search, which
  is the worst possible week to have a profile restricted;
- the last review before something becomes a public claim about a person should
  be done by that person.

Column names are matched loosely and from a candidate list, because LinkedIn has
renamed them before. When a file or column cannot be found the tool says which
one and what it looked for — an empty draft that looks like "you have nothing to
add" is the one output worth avoiding.
