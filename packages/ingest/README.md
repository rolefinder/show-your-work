# Ingest helpers

Draft generators that emit YAML **for human review** before copying into
`content/`. They never write production content automatically.

| Script | Input | Output |
|--------|-------|--------|
| `from-resume-text.py` | Plain-text resume | Draft `work` / `about` YAML snippets |
| `from-github.py` | Public GitHub username | Draft project stubs via GitHub API |
| `from-syllabus-text.py` | Plain-text course syllabus | Draft `courses` YAML — outcomes verbatim, `taught:` as TODO |

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
Parser not built yet — track in HANDOFF §8.
